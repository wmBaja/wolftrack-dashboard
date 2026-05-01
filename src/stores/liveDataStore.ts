import { defineStore } from 'pinia'
import { ref } from 'vue'

let backendPort: number | null = null;
async function getVisualizerWsBase() {
  if (!backendPort) {
    if (window.electronAPI?.getBackendPort) {
      backendPort = await window.electronAPI.getBackendPort();
    } else {
      backendPort = 8000;
    }
  }
  return `ws://127.0.0.1:${backendPort}/ws/stream`;
}

export interface SignalData {
  id: string
  name: string
  value: number | string
  timestamp: number
  arbitration_id: number
}

export const useLiveDataStore = defineStore('liveData', () => {
  const isConnected = ref(false)
  const isConnecting = ref(false)
  
  // A mapping from signal name to its array of timestamps and values
  // Storing them as separate arrays is more memory efficient for uPlot and general fast iteration
  const buffers = ref<Record<string, { timestamps: number[], values: number[] }>>({})
  
  let ws: WebSocket | null = null

  async function connect() {
    if (ws || isConnecting.value) return
    isConnecting.value = true

    const wsUrl = await getVisualizerWsBase()
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      isConnected.value = true
      isConnecting.value = false
      console.log('Connected to Live Data Stream')
    }

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as SignalData[]
        for (const data of payload) {
          if (typeof data.value !== 'number') continue // Plottable data must be numbers

          if (!buffers.value[data.id]) {
            // First time seeing this signal, initialize empty arrays
            buffers.value[data.id] = { timestamps: [], values: [] }
          }
          
          const buffer = buffers.value[data.id]
          if (buffer) {
            buffer.timestamps.push(data.timestamp)
            buffer.values.push(data.value as number)
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err)
      }
    }

    ws.onclose = () => {
      isConnected.value = false
      isConnecting.value = false
      ws = null
      console.log('Disconnected from Live Data Stream. Attempting to reconnect...')
      setTimeout(connect, 3000)
    }

    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
      ws?.close()
    }
  }

  function disconnect() {
    if (ws) {
      ws.close()
      ws = null
    }
  }

  function clearBuffers() {
    buffers.value = {}
  }

  return {
    isConnected,
    buffers,
    connect,
    disconnect,
    clearBuffers
  }
})
