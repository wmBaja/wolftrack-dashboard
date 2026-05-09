import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getVisualizerBase } from '@/lib/visualizer'

export interface LogStatus {
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number
  start_ts: number
  end_ts: number
}

export const useLogDataStore = defineStore('logData', () => {
  const status = ref<LogStatus>({
    status: 'idle',
    progress: 0,
    start_ts: 0,
    end_ts: 0
  })

  const buffers = ref<Record<string, { timestamps: number[], values: number[] }>>({})
  const dataVersion = ref(0)
  
  let pollInterval: number | null = null

  async function checkStatus() {
    try {
      const base = await getVisualizerBase()
      const res = await fetch(`${base}/api/logfile/status`)
      if (res.ok) {
        const data = await res.json()
        status.value = data
        
        if (data.status === 'ready' && pollInterval) {
          clearInterval(pollInterval)
          pollInterval = null
        }
      }
    } catch (e) {
      console.error("Error checking logfile status", e)
    }
  }

  function startPollingStatus() {
    if (pollInterval) clearInterval(pollInterval)
    pollInterval = window.setInterval(checkStatus, 1000)
    checkStatus()
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  async function queryData(signals: string[], start_ts: number, end_ts: number, max_points: number = 1000) {
    if (status.value.status !== 'ready') return
    try {
      const base = await getVisualizerBase()
      const res = await fetch(`${base}/api/logfile/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signals,
          start_ts,
          end_ts,
          max_points
        })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          for (const [sig, buf] of Object.entries(data.data)) {
            buffers.value[sig] = buf as { timestamps: number[], values: number[] }
          }
          dataVersion.value++
        }
      }
    } catch (e) {
      console.error("Error querying log data", e)
    }
  }

  return {
    status,
    buffers,
    dataVersion,
    startPollingStatus,
    stopPolling,
    queryData
  }
})
