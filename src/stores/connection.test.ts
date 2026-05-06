// @vitest-environment node
import { createPinia, setActivePinia } from 'pinia'
import { useConnectionStore, getTelemetryLog } from './connection'
import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'

// ─── Global mocks ────────────────────────────────────────────────────────────

// Mock localStorage with a real object
const mockStorageData: Record<string, string> = {}
let mockSetItemCallback: ((key: string, value: string) => void) | null = null

const mockLocalStorage: Storage = {
  getItem: (key: string) => mockStorageData[key] || null,
  setItem: (key: string, value: string) => {
    mockStorageData[key] = value
    if (mockSetItemCallback) mockSetItemCallback(key, value)
  },
  removeItem: (key: string) => { delete mockStorageData[key] },
  clear: () => { Object.keys(mockStorageData).forEach(k => delete mockStorageData[k]) },
  length: Object.keys(mockStorageData).length,
  key: (n: number) => Object.keys(mockStorageData)[n] || null,
}

// Mock window for node environment
const mockWindow: Record<string, unknown> = { electronAPI: undefined }

// ─── Test helpers ────────────────────────────────────────────────────────────

function mockFetchResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ status: 'ok', name: 'test', version: '1.0.0' }),
    ...overrides,
  }
}

function clearStorage() {
  Object.keys(mockStorageData).forEach(k => delete mockStorageData[k])
  mockFetchFn.mockReset()
  mockPerformanceNowFn.mockClear()
  mockPerformanceNowFn.mockImplementation(() => 1000)
  vi.clearAllMocks()
  mockSetItemCallback = null
}

// Module-level mock references
let mockFetchFn: ReturnType<typeof vi.fn>
let mockPerformanceNowFn: ReturnType<typeof vi.fn>

// ─── Setup/teardown ─────────────────────────────────────────────────────────

describe('Connection Store', () => {
  beforeAll(() => {
    // Create mocks and assign to globals
    mockFetchFn = vi.fn()
    mockPerformanceNowFn = vi.fn(() => 1000)

    // Mock localStorage
    globalThis.localStorage = mockLocalStorage as any

    // Mock fetch
    globalThis.fetch = mockFetchFn as any

    // Mock performance.now
    globalThis.performance = { now: mockPerformanceNowFn } as any

    // Mock window (not available in node)
    globalThis.window = mockWindow as any
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    clearStorage()
    // Reset window mock
    mockWindow.electronAPI = undefined
  })

  describe('initialization', () => {
    it('should load defaults from localStorage when empty', () => {
      const store = useConnectionStore()
      expect(store.ip).toBe('127.0.0.1')
      expect(store.port).toBe(5500)
      expect(store.zmqPort).toBeNull()
      expect(store.sourceMode).toBe('live')
      expect(store.status).toBe('idle')
    })

    it('should load persisted values from localStorage', () => {
      mockStorageData['wolftrack-connection'] = JSON.stringify({
        ip: '192.168.1.100',
        port: 8080,
        zmqPort: 5555,
        sourceMode: 'live',
      })
      const store = useConnectionStore()
      expect(store.ip).toBe('192.168.1.100')
      expect(store.port).toBe(8080)
      expect(store.zmqPort).toBe(5555)
      expect(store.sourceMode).toBe('live')
    })

    it('should default to live source mode when invalid mode is stored', () => {
      mockStorageData['wolftrack-connection'] = JSON.stringify({
        ip: '10.0.0.1',
        port: 3000,
        sourceMode: 'invalid',
      })
      const store = useConnectionStore()
      expect(store.sourceMode).toBe('live')
    })
  })

  describe('validation', () => {
    it('should validate valid IPv4 addresses', () => {
      const store = useConnectionStore()
      store.ip = '192.168.1.1'
      expect(store.ip).toBe('192.168.1.1')
    })

    it('should validate valid hostnames', () => {
      const store = useConnectionStore()
      store.ip = 'daq.local'
      expect(store.ip).toBe('daq.local')
    })

    it('should reject invalid IP addresses with octets > 255', async () => {
      mockFetchFn.mockResolvedValue(mockFetchResponse({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      }))
      const store = useConnectionStore()
      store.ip = '999.999.999.999'
      store.port = 5000
      await store.connect()
      expect(store.status).toBe('error')
      expect(store.errorMessage).toContain('Invalid')
    })

    it('should reject out-of-range ports', async () => {
      const store = useConnectionStore()
      store.ip = '127.0.0.1'
      store.port = 70000
      await store.connect()
      expect(store.status).toBe('error')
      expect(store.errorMessage).toContain('Port')
    })

    it('should reject ports below 1', async () => {
      const store = useConnectionStore()
      store.ip = '127.0.0.1'
      store.port = 0
      await store.connect()
      expect(store.status).toBe('error')
      expect(store.errorMessage).toContain('Port')
    })
  })

  describe('connect/disconnect (live mode)', () => {
    it('should connect successfully on healthy health check', async () => {
      mockFetchFn.mockResolvedValue(mockFetchResponse({
        json: () => Promise.resolve({ status: 'ok', name: 'DAQ-001', version: '1.0.0' }),
      }))
      const store = useConnectionStore()
      store.ip = '127.0.0.1'
      store.port = 5000
      await store.connect()
      expect(store.status).toBe('connected')
      expect(store.lastSeen).toBeTruthy()
      expect(store.errorMessage).toBeNull()
    })

    it('should set error on failed health check', async () => {
      mockFetchFn.mockResolvedValue(mockFetchResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }))
      const store = useConnectionStore()
      store.ip = '127.0.0.1'
      store.port = 5000
      await store.connect()
      expect(store.status).toBe('error')
      expect(store.errorMessage).toContain('Health check failed')
    })

    it('should set error on network failure', async () => {
      mockFetchFn.mockRejectedValue(new Error('Network error'))
      const store = useConnectionStore()
      store.ip = '127.0.0.1'
      store.port = 5000
      await store.connect()
      expect(store.status).toBe('error')
      expect(store.errorMessage).toContain('Network error')
    })

    it('should disconnect and clear status', async () => {
      mockFetchFn.mockResolvedValue(mockFetchResponse({
        json: () => Promise.resolve({ status: 'ok' }),
      }))
      const store = useConnectionStore()
      store.ip = '127.0.0.1'
      store.port = 5000
      await store.connect()
      expect(store.status).toBe('connected')

      store.disconnect()
      expect(store.status).toBe('idle')
      expect(store.lastSeen).toBeNull()
    })

    it('should persist connection settings to localStorage', async () => {
      let capturedValue = ''
      mockSetItemCallback = (_key: string, value: string) => { capturedValue = value }
      mockFetchFn.mockResolvedValue(mockFetchResponse({
        json: () => Promise.resolve({ status: 'ok' }),
      }))
      const store = useConnectionStore()
      store.ip = '192.168.1.50'
      store.port = 8080
      await store.connect()

      expect(capturedValue).toContain('192.168.1.50')
      expect(capturedValue).toContain('8080')
      expect(capturedValue).toContain('live')
    })
  })

  describe('file mode', () => {
    it('should connect with a file path', async () => {
      const store = useConnectionStore()
      store.setSourceMode('file')
      store.setFilePath('/path/to/log.blf')
      await store.connect()
      expect(store.status).toBe('connected')
      expect(store.lastSeen).toBeTruthy()
    })

    it('should error when connecting without a file path', async () => {
      const store = useConnectionStore()
      store.setSourceMode('file')
      store.setFilePath('')
      await store.connect()
      expect(store.status).toBe('error')
      expect(store.errorMessage).toContain('Log file')
    })

    it('should switch source mode', () => {
      const store = useConnectionStore()
      // After init with empty storage, source mode defaults to 'live'
      expect(store.sourceMode).toBe('live')
      store.setSourceMode('file')
      expect(store.sourceMode).toBe('file')
    })
  })

  describe('ping', () => {
    it('should return true on successful ping', async () => {
      mockFetchFn.mockResolvedValue(mockFetchResponse({
        json: () => Promise.resolve({ status: 'ok' }),
      }))
      let callCount = 0
      mockPerformanceNowFn.mockImplementation(() => {
        callCount++
        return callCount === 1 ? 1000 : 1050 // 50ms latency
      })
      const store = useConnectionStore()
      store.sourceMode = 'live'
      // Set status to connected (ping only works when connected)
      store.status = 'connected' as any
      const result = await store.ping()
      expect(result).toBe(true)
      expect(store.lastSeen).toBeTruthy()
    })

    it('should return false on failed ping', async () => {
      mockFetchFn.mockResolvedValue(mockFetchResponse({
        ok: false,
        status: 503,
      }))
      const store = useConnectionStore()
      store.sourceMode = 'live'
      store.status = 'connected' as any
      const result = await store.ping()
      expect(result).toBe(false)
    })
  })

  describe('discovery', () => {
    it('should return empty array when electronAPI is not available', async () => {
      const store = useConnectionStore()
      const results = await store.discover()
      expect(results).toEqual([])
    })

    it('should call electronAPI.discoverDevices when available', async () => {
      const mockDiscover = vi.fn().mockResolvedValue([
        { ip: '192.168.1.100', port: 5000, name: 'DAQ-001' },
      ])
      mockWindow.electronAPI = { discoverDevices: mockDiscover }

      const store = useConnectionStore()
      const results = await store.discover()
      expect(mockDiscover).toHaveBeenCalled()
      expect(results).toHaveLength(1)
      expect(store.ip).toBe('192.168.1.100')
      expect(store.port).toBe(5000)
    })
  })

  describe('telemetry', () => {
    it('should log connection events', async () => {
      mockFetchFn.mockResolvedValue(mockFetchResponse({
        json: () => Promise.resolve({ status: 'ok' }),
      }))
      const store = useConnectionStore()
      store.ip = '127.0.0.1'
      store.port = 5000
      await store.connect()

      const log = getTelemetryLog()
      expect(log.some(e => e.type === 'connect_success')).toBe(true)
    })

    it('should log disconnect events', async () => {
      mockFetchFn.mockResolvedValue(mockFetchResponse({
        json: () => Promise.resolve({ status: 'ok' }),
      }))
      const store = useConnectionStore()
      store.ip = '127.0.0.1'
      store.port = 5000
      await store.connect()
      store.disconnect('test')

      const log = getTelemetryLog()
      expect(log.some(e => e.type === 'disconnect' && e.reason === 'test')).toBe(true)
    })
  })
})
