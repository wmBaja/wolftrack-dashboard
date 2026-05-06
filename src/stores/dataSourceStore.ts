import { defineStore } from 'pinia'
import { ref } from 'vue'

let backendPort: number | null = null;
async function getVisualizerBase() {
  if (!backendPort) {
    if (window.electronAPI?.getBackendPort) {
      backendPort = await window.electronAPI.getBackendPort();
    } else {
      backendPort = 8000;
    }
  }
  return `http://127.0.0.1:${backendPort}`;
}

export type DataSourceMode = 'zmq' | 'logfile'
export type DataSourceStatus = 'stopped' | 'running' | 'loading' | 'error'

export interface DataSourceConfig {
  source: DataSourceMode
  log_file: string | null
  playback_speed: number
}

export const useDataSourceStore = defineStore('dataSource', () => {
  const status = ref<DataSourceStatus>('stopped')
  const error = ref<string | null>(null)
  const config = ref<DataSourceConfig>({
    source: 'zmq',
    log_file: null,
    playback_speed: 1.0,
  })

  async function fetchConfig(): Promise<void> {
    try {
      const baseUrl = await getVisualizerBase()
      const res = await fetch(`${baseUrl}/api/config`)
      if (!res.ok) throw new Error(`Failed to fetch config: ${res.statusText}`)
      const data = await res.json()
      config.value = data
      status.value = 'running'
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      status.value = 'error'
    }
  }

  async function applyConfig(
    update: Partial<DataSourceConfig>,
    files?: { logFileBlob: File | null }
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

      const baseUrl = await getVisualizerBase()
      const res = await fetch(`${baseUrl}/api/upload_config`, {
        method: 'POST',
        body: formData,
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Unknown error')
      config.value = payload
      status.value = 'running'
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      status.value = 'error'
    }
  }

  async function stop(): Promise<void> {
    status.value = 'loading'
    error.value = null
    try {
      const baseUrl = await getVisualizerBase()
      await fetch(`${baseUrl}/api/stop`, { method: 'POST' })
      status.value = 'stopped'
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      status.value = 'error'
    }
  }

  return { status, error, config, fetchConfig, applyConfig, stop }
})
