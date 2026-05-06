import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getVisualizerBase } from '@/lib/visualizer'
import { useDataSourceStore } from './dataSourceStore'

export type DaqConnectionState =
  | 'disconnected'
  | 'discovering'
  | 'checking'
  | 'connecting'
  | 'connected'
  | 'error'

export interface DaqTarget {
  host: string
  port: number
  label?: string
  lastUsedAt?: string
}

export interface DaqDiscoveryResult extends DaqTarget {
  id: string
}

interface DaqStorage {
  lastTarget: DaqTarget | null
  recentTargets: DaqTarget[]
}

interface LoggerHealthResponse {
  status: 'healthy' | 'unhealthy'
  session?: boolean
  can_connected?: boolean
  dbc_loaded?: boolean
  error?: string
}

interface LoggerStreamEndpoint {
  transport: string
  host: string
  port: number
  enabled: boolean
}

const STORAGE_KEY = 'dashboard-daq-targets'
const DEFAULT_PORT = 5000
const REQUEST_TIMEOUT_MS = 4000
const MAX_RECENT_TARGETS = 5

function normalizeTarget(target: Partial<DaqTarget>): DaqTarget | null {
  const host = `${target.host ?? ''}`.trim()
  const port = Number(target.port)

  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
    return null
  }

  return {
    host,
    port,
    label: target.label?.trim() || undefined,
    lastUsedAt: target.lastUsedAt,
  }
}

function withTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timeout)
  })
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text()
    const snippet = text.trim().slice(0, 120)
    throw new Error(
      response.ok
        ? fallbackMessage
        : `${fallbackMessage} (${response.status}). ${snippet || 'Response was not JSON.'}`
    )
  }

  return await response.json() as T
}

export const useDaqConnectionStore = defineStore('daqConnection', () => {
  const connectionState = ref<DaqConnectionState>('disconnected')
  const error = ref<string | null>(null)
  const target = ref<DaqTarget>({ host: '', port: DEFAULT_PORT })
  const lastTarget = ref<DaqTarget | null>(null)
  const recentTargets = ref<DaqTarget[]>([])
  const discoveries = ref<DaqDiscoveryResult[]>([])
  const health = ref<LoggerHealthResponse | null>(null)

  const isConnected = computed(() => connectionState.value === 'connected')

  function loadPersistedTargets() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return

      const parsed = JSON.parse(saved) as Partial<DaqStorage>
      lastTarget.value = parsed.lastTarget ? normalizeTarget(parsed.lastTarget) : null
      recentTargets.value = Array.isArray(parsed.recentTargets)
        ? parsed.recentTargets.map(normalizeTarget).filter((value): value is DaqTarget => value !== null)
        : []

      if (lastTarget.value) {
        target.value = { ...lastTarget.value }
      }
    } catch (storageError) {
      console.error('Failed to load DAQ targets:', storageError)
    }
  }

  function persistTargets() {
    try {
      const payload: DaqStorage = {
        lastTarget: lastTarget.value,
        recentTargets: recentTargets.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (storageError) {
      console.error('Failed to persist DAQ targets:', storageError)
    }
  }

  function rememberTarget(nextTarget: DaqTarget) {
    const timestampedTarget: DaqTarget = {
      ...nextTarget,
      lastUsedAt: new Date().toISOString(),
    }

    lastTarget.value = timestampedTarget
    recentTargets.value = [
      timestampedTarget,
      ...recentTargets.value.filter(item => !(item.host === timestampedTarget.host && item.port === timestampedTarget.port)),
    ].slice(0, MAX_RECENT_TARGETS)
    target.value = { ...timestampedTarget }
    persistTargets()
  }

  function selectTarget(nextTarget: DaqTarget) {
    target.value = { ...nextTarget }
    error.value = null
  }

  async function fetchVisualizerLiveSource() {
    const dataSourceStore = useDataSourceStore()
    await dataSourceStore.fetchLiveSource()

    if (dataSourceStore.liveSource.connected) {
      connectionState.value = 'connected'
      const liveTarget = normalizeTarget({
        host: dataSourceStore.liveSource.flask_host ?? '',
        port: dataSourceStore.liveSource.flask_port ?? DEFAULT_PORT,
      })
      if (liveTarget) {
        target.value = liveTarget
      }
      error.value = null
      return
    }

    if (connectionState.value !== 'error') {
      connectionState.value = 'disconnected'
    }
  }

  async function discoverServices() {
    if (!window.electronAPI?.discoverDaqServices) {
      connectionState.value = 'error'
      error.value = 'mDNS discovery is unavailable in this build.'
      return
    }

    connectionState.value = 'discovering'
    error.value = null

    try {
      const services = await window.electronAPI.discoverDaqServices()
      discoveries.value = services
      if (services.length === 0) {
        error.value = 'No DAQ services found. Make sure the logger is running, zeroconf is installed on the DAQ, and both devices are on the same network.'
      }
      connectionState.value = isConnected.value ? 'connected' : 'disconnected'
    } catch (discoverError) {
      connectionState.value = 'error'
      error.value = discoverError instanceof Error ? discoverError.message : String(discoverError)
    }
  }

  async function connect() {
    const nextTarget = normalizeTarget(target.value)
    if (!nextTarget) {
      connectionState.value = 'error'
      error.value = 'Enter a valid DAQ host and port.'
      return false
    }

    const dataSourceStore = useDataSourceStore()
    const loggerBase = `http://${nextTarget.host}:${nextTarget.port}`
    error.value = null

    try {
      connectionState.value = 'checking'
      const healthResponse = await withTimeout(`${loggerBase}/health`)
      const healthPayload = await parseJsonResponse<LoggerHealthResponse>(
        healthResponse,
        'DAQ health endpoint returned an unexpected response.'
      )
      health.value = healthPayload

      if (!healthResponse.ok || healthPayload.status !== 'healthy') {
        throw new Error(healthPayload.error || 'DAQ health check failed.')
      }

      const streamResponse = await withTimeout(`${loggerBase}/api/stream-endpoint`)
      const streamPayload = await parseJsonResponse<LoggerStreamEndpoint>(
        streamResponse,
        'DAQ stream endpoint lookup failed.'
      )
      if (!streamResponse.ok) {
        throw new Error(`DAQ stream endpoint lookup failed (${streamResponse.status}).`)
      }
      if (!streamPayload.enabled) {
        throw new Error('DAQ live streaming is disabled on the logger.')
      }

      connectionState.value = 'connecting'
      const visualizerBase = await getVisualizerBase()
      const connectResponse = await fetch(`${visualizerBase}/api/live_source/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flask_host: nextTarget.host,
          flask_port: nextTarget.port,
          zmq_host: streamPayload.host,
          zmq_port: streamPayload.port,
        }),
      })

      const connectPayload = await parseJsonResponse<{ detail?: string; message?: string }>(
        connectResponse,
        'Visualizer live-source connect returned an unexpected response.'
      )
      if (!connectResponse.ok) {
        throw new Error(connectPayload.detail ?? connectPayload.message ?? 'Failed to connect live source.')
      }

      dataSourceStore.liveSource = {
        connected: true,
        flask_host: nextTarget.host,
        flask_port: nextTarget.port,
        zmq_host: streamPayload.host,
        zmq_port: streamPayload.port,
      }
      rememberTarget(nextTarget)
      connectionState.value = 'connected'
      return true
    } catch (connectError) {
      connectionState.value = 'error'
      if (connectError instanceof DOMException && connectError.name === 'AbortError') {
        error.value = 'DAQ request timed out. Check the host, port, and network connection.'
      } else {
        error.value = connectError instanceof Error ? connectError.message : String(connectError)
      }
      return false
    }
  }

  async function disconnect() {
    try {
      const visualizerBase = await getVisualizerBase()
      const response = await fetch(`${visualizerBase}/api/live_source/disconnect`, {
        method: 'POST',
      })
      const payload = await parseJsonResponse<{ detail?: string; message?: string }>(
        response,
        'Visualizer live-source disconnect returned an unexpected response.'
      )
      if (!response.ok) {
        throw new Error(payload.detail ?? payload.message ?? 'Failed to disconnect live source.')
      }

      const dataSourceStore = useDataSourceStore()
      dataSourceStore.liveSource.connected = false
      connectionState.value = 'disconnected'
      error.value = null
    } catch (disconnectError) {
      connectionState.value = 'error'
      error.value = disconnectError instanceof Error ? disconnectError.message : String(disconnectError)
    }
  }

  function handleVisualizerMessage(payload: unknown) {
    if (!payload || typeof payload !== 'object' || !('type' in payload) || payload.type !== 'live_source') {
      return
    }

    if ('connected' in payload && payload.connected) {
      connectionState.value = 'connected'
      error.value = null
      return
    }

    if (connectionState.value !== 'error') {
      connectionState.value = 'disconnected'
    }
  }

  loadPersistedTargets()

  return {
    connectionState,
    error,
    target,
    lastTarget,
    recentTargets,
    discoveries,
    health,
    isConnected,
    loadPersistedTargets,
    selectTarget,
    discoverServices,
    fetchVisualizerLiveSource,
    connect,
    disconnect,
    handleVisualizerMessage,
  }
})
