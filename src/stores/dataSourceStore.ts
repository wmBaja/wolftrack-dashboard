import { defineStore } from 'pinia'
import { ref } from 'vue'

const VISUALIZER_BASE = 'http://127.0.0.1:8000'

export type DataSourceMode = 'zmq' | 'logfile'
export type DataSourceStatus = 'stopped' | 'running' | 'loading' | 'error'

export interface DataSourceConfig {
  source: DataSourceMode
  log_file: string | null
  dbc_file: string | null
  playback_speed: number
}

export const useDataSourceStore = defineStore('dataSource', () => {
  const status = ref<DataSourceStatus>('stopped')
  const error = ref<string | null>(null)
  const config = ref<DataSourceConfig>({
    source: 'zmq',
    log_file: null,
    dbc_file: null,
    playback_speed: 1.0,
  })

  const dbcSignals = ref<{ id: string, message: string, name: string, unit: string }[]>([])

  async function fetchSignals(): Promise<void> {
    try {
      const res = await fetch(`${VISUALIZER_BASE}/api/signals`)
      if (!res.ok) return
      const data = await res.json()
      dbcSignals.value = data.signals || []
    } catch (e) {
      console.error('Failed to fetch signals', e)
    }
  }

  async function fetchConfig(): Promise<void> {
    try {
      const res = await fetch(`${VISUALIZER_BASE}/api/config`)
      if (!res.ok) throw new Error(`Failed to fetch config: ${res.statusText}`)
      const data = await res.json()
      config.value = data
      status.value = 'running'
      await fetchSignals()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      status.value = 'error'
    }
  }

  async function applyConfig(
    update: Partial<DataSourceConfig>,
    files?: { logFileBlob: File | null; dbcFileBlob: File | null }
  ): Promise<void> {
    status.value = 'loading'
    error.value = null
    try {
      const payload = { ...config.value, ...update }
      
      const formData = new FormData()
      formData.append('source', payload.source)
      formData.append('playback_speed', payload.playback_speed.toString())
      
      if (files?.logFileBlob) {
        formData.append('log_file_upload', files.logFileBlob)
      } else if (payload.log_file) {
        formData.append('existing_log', payload.log_file)
      }

      if (files?.dbcFileBlob) {
        formData.append('dbc_file_upload', files.dbcFileBlob)
      } else if (payload.dbc_file) {
        formData.append('existing_dbc', payload.dbc_file)
      }

      const res = await fetch(`${VISUALIZER_BASE}/api/upload_config`, {
        method: 'POST',
        body: formData,
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Unknown error')
      config.value = payload
      status.value = 'running'
      await fetchSignals()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      status.value = 'error'
    }
  }

  async function stop(): Promise<void> {
    status.value = 'loading'
    error.value = null
    try {
      await fetch(`${VISUALIZER_BASE}/api/stop`, { method: 'POST' })
      status.value = 'stopped'
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      status.value = 'error'
    }
  }

  return { status, error, config, dbcSignals, fetchConfig, applyConfig, stop, fetchSignals }
})
