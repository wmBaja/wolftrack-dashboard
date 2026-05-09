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
  
  const playbackSpeed = ref(1.0)
  const currentTime = ref(0)
  const isPlaying = ref(false)
  
  let pollInterval: number | null = null
  let reqFrame = 0
  let lastFrameTime = 0

  function startPlayback(speed: number) {
    playbackSpeed.value = speed
    if (speed <= 0) {
      isPlaying.value = false
      currentTime.value = status.value.end_ts
      dataVersion.value++
      return
    }
    
    isPlaying.value = true
    lastFrameTime = performance.now()
    
    function loop(now: number) {
      if (!isPlaying.value) return
      
      const dt = (now - lastFrameTime) / 1000
      lastFrameTime = now
      
      currentTime.value += dt * playbackSpeed.value
      
      if (currentTime.value >= status.value.end_ts) {
        currentTime.value = status.value.end_ts
        isPlaying.value = false
      }
      
      dataVersion.value++
      if (isPlaying.value) {
        reqFrame = requestAnimationFrame(loop)
      }
    }
    
    reqFrame = requestAnimationFrame(loop)
  }

  function clearBuffers() {
    buffers.value = {}
    isPlaying.value = false
    if (reqFrame) cancelAnimationFrame(reqFrame)
    status.value = { status: 'idle', progress: 0, start_ts: 0, end_ts: 0 }
    dataVersion.value++
  }

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
          
          currentTime.value = data.start_ts
          import('./dataSourceStore').then(m => {
            const ds = m.useDataSourceStore()
            startPlayback(ds.config.playback_speed ?? 1.0)
          })
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
    currentTime,
    startPollingStatus,
    stopPolling,
    queryData,
    clearBuffers
  }
})
