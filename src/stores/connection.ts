import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'
export type SourceMode = 'live' | 'file'

export interface ConnectionState {
  status: ConnectionStatus
  sourceMode: SourceMode
  ip: string
  port: number
  zmqPort: number | null
  filePath: string | null
  lastSeen: string | null
  errorMessage: string | null
  errorCount: number
}

export interface HealthResponse {
  status: string
  name?: string
  version?: string
  zmq_port?: number
}

export interface InfoResponse {
  name?: string
  model?: string
  serial?: string
  apiVersion?: string
}

export interface DiscoveryResult {
  ip: string
  port: number
  name?: string
  model?: string
  serial?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'wolftrack-connection'
const DEFAULT_IP = '127.0.0.1'
const DEFAULT_PORT = 5500
const PING_INTERVAL_MS = 5000
const PING_TIMEOUT_MS = 3000
const MAX_ERROR_COUNT = 3
const MAX_RETRY_DELAY_MS = 30000
const INITIAL_RETRY_DELAY_MS = 1000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadFromStorage(): { ip: string; port: number; zmqPort: number | null; sourceMode: SourceMode } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const ip = typeof parsed.ip === 'string' && parsed.ip.length > 0 ? parsed.ip : DEFAULT_IP
      const port = typeof parsed.port === 'number' && parsed.port >= 1 && parsed.port <= 65535 ? parsed.port : DEFAULT_PORT
      const zmqPort = typeof parsed.zmqPort === 'number' ? parsed.zmqPort : null
      const sourceMode = parsed.sourceMode === 'live' || parsed.sourceMode === 'file' ? parsed.sourceMode : 'live'
      return { ip, port, zmqPort, sourceMode }
    }
  } catch {
    // ignore
  }
  return { ip: DEFAULT_IP, port: DEFAULT_PORT, zmqPort: null, sourceMode: 'live' }
}

function saveToStorage(state: { ip: string; port: number; zmqPort: number | null; sourceMode: SourceMode }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

function buildBaseUrl(ip: string, port: number): string {
  return `http://${ip}:${port}`
}

// ─── Validation ──────────────────────────────────────────────────────────────

const IPv4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

function validateIp(ip: string): string | null {
  if (!ip || ip.trim().length === 0) return 'IP address is required'
  if (IPv4_REGEX.test(ip)) {
    const parts = ip.split('.').map(Number)
    if (parts.some((n) => n > 255)) return 'Invalid IP octet (>255)'
  }
  // Allow hostnames (alphanumeric, dots, hyphens)
  if (/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(ip) || /^[a-zA-Z0-9]$/.test(ip)) {
    return null
  }
  return 'Invalid IP address or hostname'
}

function validatePort(port: number): string | null {
  if (!Number.isInteger(port)) return 'Port must be an integer'
  if (port < 1 || port > 65535) return 'Port must be between 1 and 65535'
  return null
}

function validateFilePath(path: string): string | null {
  if (!path || path.trim().length === 0) return 'Log file is required'
  return null
}

// ─── Telemetry / Logging ─────────────────────────────────────────────────────

type LogEvent =
  | { type: 'connect_attempt'; ip: string; port: number }
  | { type: 'connect_success'; ip: string; port: number; version?: string }
  | { type: 'connect_error'; ip: string; port: number; error: string }
  | { type: 'disconnect'; reason: string }
  | { type: 'ping_success'; latencyMs: number }
  | { type: 'ping_error'; error: string }
  | { type: 'discovery_attempt' }
  | { type: 'discovery_result'; results: DiscoveryResult[] }
  | { type: 'source_mode_change'; mode: SourceMode }

const logEvents: LogEvent[] = []

export function logConnectionEvent(event: LogEvent) {
  const entry = { ...event, timestamp: new Date().toISOString() }
  logEvents.push(entry)
  // Keep last 200 entries
  if (logEvents.length > 200) logEvents.shift()
  console.debug('[Connection]', entry)
}

export function getTelemetryLog(): LogEvent[] {
  return [...logEvents]
}

// ─── Store ───────────────────────────────────────────────────────────────────

const storedDefaults = loadFromStorage()

export const useConnectionStore = defineStore('connection', () => {
  const status = ref<ConnectionStatus>(storedDefaults.sourceMode === 'live' ? 'idle' : 'connected')
  const sourceMode = ref<SourceMode>(storedDefaults.sourceMode)
  const ip = ref<string>(storedDefaults.ip)
  const port = ref<number>(storedDefaults.port)
  const zmqPort = ref<number | null>(storedDefaults.zmqPort)
  const filePath = ref<string | null>(null)
  const lastSeen = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)
  const errorCount = ref(0)

  // Internal refs for ping/retry management
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryDelay = INITIAL_RETRY_DELAY_MS

  const isConnected = computed(() => status.value === 'connected')
  const isConnecting = computed(() => status.value === 'connecting')
  const isError = computed(() => status.value === 'error')
  const isIdle = computed(() => status.value === 'idle')

  const statusColor = computed(() => {
    switch (status.value) {
      case 'connected': return 'var(--color-success)'
      case 'connecting': return 'var(--color-warning)'
      case 'error': return 'var(--color-danger)'
      default: return 'var(--color-muted)'
    }
  })

  const statusLabel = computed(() => {
    switch (status.value) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting…'
      case 'error': return 'Error'
      default: return 'Disconnected'
    }
  })

  // ─── Actions ─────────────────────────────────────────────────────────────

  function clearError() {
    errorMessage.value = null
    errorCount.value = 0
    if (status.value === 'error') {
      status.value = 'idle'
    }
  }

  function setError(msg: string) {
    errorMessage.value = msg
    errorCount.value += 1
    status.value = 'error'
  }

  function setSourceMode(mode: SourceMode) {
    sourceMode.value = mode
    logConnectionEvent({ type: 'source_mode_change', mode })
    saveToStorage({ ip: ip.value, port: port.value, zmqPort: zmqPort.value, sourceMode: mode })

    // If switching to file mode, reset to connected
    if (mode === 'file') {
      status.value = 'connected'
      stopPing()
    } else {
      // If switching to live mode, reset to idle
      if (status.value === 'connected') {
        status.value = 'idle'
      }
    }
  }

  function setFilePath(path: string) {
    filePath.value = path
  }

  async function connect() {
    clearError()

    if (sourceMode.value === 'file') {
      const fileErr = validateFilePath(filePath.value ?? '')
      if (fileErr) {
        setError(fileErr)
        return
      }
      status.value = 'connected'
      lastSeen.value = new Date().toISOString()
      logConnectionEvent({ type: 'connect_success', ip: 'local', port: 0 })
      return
    }

    // Live mode
    const currentIp = ip.value
    const currentPort = port.value
    const ipErr = validateIp(currentIp)
    const portErr = validatePort(currentPort)
    if (ipErr) {
      setError(ipErr)
      return
    }
    if (portErr) {
      setError(portErr)
      return
    }

    status.value = 'connecting'
    saveToStorage({ ip: currentIp, port: currentPort, zmqPort: zmqPort.value, sourceMode: sourceMode.value })
    logConnectionEvent({ type: 'connect_attempt', ip: currentIp, port: currentPort })

    try {
      const baseUrl = buildBaseUrl(currentIp, currentPort)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)

      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`Health check failed: ${res.status} ${res.statusText}`)
      }

      const data: HealthResponse & { zmq_port?: number } = await res.json()

      if (data.status !== 'ok' && data.status !== 'healthy') {
        throw new Error(`DAQ reported unhealthy status: ${data.status}`)
      }

      // Extract ZMQ port from health response if provided
      if (data.zmq_port != null) {
        zmqPort.value = data.zmq_port
      }

      status.value = 'connected'
      lastSeen.value = new Date().toISOString()
      errorCount.value = 0
      retryDelay = INITIAL_RETRY_DELAY_MS
      logConnectionEvent({ type: 'connect_success', ip: currentIp, port: currentPort, version: data.version })

      // Start ping loop
      startPing()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      logConnectionEvent({ type: 'connect_error', ip: currentIp, port: currentPort, error: msg })
      scheduleRetry()
    }
  }

  function disconnect(reason = 'user') {
    stopPing()
    cancelRetry()
    status.value = 'idle'
    lastSeen.value = null
    logConnectionEvent({ type: 'disconnect', reason })
  }

  async function ping(): Promise<boolean> {
    if (sourceMode.value !== 'live' || !isConnected.value) return false

    try {
      const baseUrl = buildBaseUrl(ip.value, port.value)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
      const start = performance.now()

      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`Ping failed: ${res.status}`)
      }

      // Also check for zmq_port update during ping (edge case: port changed)
      const data = await res.json()
      if (data.zmq_port != null) {
        zmqPort.value = data.zmq_port
      }

      const latency = Math.round(performance.now() - start)
      lastSeen.value = new Date().toISOString()
      errorCount.value = 0
      retryDelay = INITIAL_RETRY_DELAY_MS
      logConnectionEvent({ type: 'ping_success', latencyMs: latency })
      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logConnectionEvent({ type: 'ping_error', error: msg })

      // After MAX_ERROR_COUNT consecutive failures, mark as error
      if (errorCount.value >= MAX_ERROR_COUNT) {
        setError(`Connection lost: ${msg}`)
        stopPing()
        scheduleRetry()
        return false
      }
      errorCount.value += 1
      return false
    }
  }

  async function discover(): Promise<DiscoveryResult[]> {
    logConnectionEvent({ type: 'discovery_attempt' })

    // Browser build: no-op (network scanning / mDNS blocked)
    if (!window.electronAPI) {
      console.warn('[Connection] Auto-discovery is only available in Electron builds')
      logConnectionEvent({ type: 'discovery_result', results: [] })
      return []
    }

    try {
      const results = await window.electronAPI.discoverDevices() as DiscoveryResult[]
      logConnectionEvent({ type: 'discovery_result', results })

      if (results && results.length > 0) {
        // Auto-select first result
        const first = results[0]!
        ip.value = first.ip
        port.value = first.port
        saveToStorage({ ip: first.ip, port: first.port, zmqPort: zmqPort.value, sourceMode: 'live' })
      }

      return results
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Connection] Discovery failed:', msg)
      logConnectionEvent({ type: 'discovery_result', results: [] })
      return []
    }
  }

  // ─── Ping Loop ───────────────────────────────────────────────────────────

  function startPing() {
    stopPing()
    pingTimer = setInterval(async () => {
      await ping()
    }, PING_INTERVAL_MS)
  }

  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer)
      pingTimer = null
    }
  }

  // ─── Retry Strategy ──────────────────────────────────────────────────────

  function scheduleRetry() {
    cancelRetry()
    retryTimer = setTimeout(() => {
      if (sourceMode.value === 'live' && (status.value === 'error' || status.value === 'idle')) {
        status.value = 'connecting'
        logConnectionEvent({ type: 'connect_attempt', ip: ip.value, port: port.value })
        connect().catch(() => {
          // connect already handles error state
        })
      }
    }, retryDelay)

    // Exponential backoff, capped
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
  }

  function cancelRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  function init() {
    const loaded = loadFromStorage()
    ip.value = loaded.ip
    port.value = loaded.port
    zmqPort.value = loaded.zmqPort
    sourceMode.value = loaded.sourceMode

    // If last mode was file and we have a path, auto-connect
    if (sourceMode.value === 'file' && filePath.value) {
      status.value = 'connected'
    }
  }

  // Auto-init on store creation
  init()

  return {
    // State
    status,
    sourceMode,
    ip,
    port,
    zmqPort,
    filePath,
    lastSeen,
    errorMessage,
    errorCount,
    // Computed
    isConnected,
    isConnecting,
    isError,
    isIdle,
    statusColor,
    statusLabel,
    // Actions
    clearError,
    setError,
    setSourceMode,
    setFilePath,
    connect,
    disconnect,
    ping,
    discover,
    init,
  }
})
