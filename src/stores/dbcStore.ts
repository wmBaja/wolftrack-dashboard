import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getVisualizerBase } from '@/lib/visualizer'

export interface DbcSignal {
  id: string
  node: string
  message: string
  name: string
  unit: string
}

export interface DbcFileInfo {
  name: string
  size: number
  mtime: number
}

export const useDbcStore = defineStore('dbcStore', () => {
  const availableDbcs = ref<DbcFileInfo[]>([])
  const activeDbc = ref<string | null>(null)
  const signals = ref<DbcSignal[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDbcs() {
    try {
      const baseUrl = await getVisualizerBase()
      const res = await fetch(`${baseUrl}/api/dbc`)
      if (!res.ok) throw new Error('Failed to fetch DBCs')
      const data = await res.json()
      availableDbcs.value = data.available
      activeDbc.value = data.active
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function fetchSignals() {
    try {
      const baseUrl = await getVisualizerBase()
      const res = await fetch(`${baseUrl}/api/signals`)
      if (!res.ok) throw new Error('Failed to fetch signals')
      const data = await res.json()
      signals.value = data.signals || []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function uploadDbc(file: File) {
    isLoading.value = true
    error.value = null
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const baseUrl = await getVisualizerBase()
      const res = await fetch(`${baseUrl}/api/dbc/upload`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Upload failed')
      }
      
      await fetchDbcs()
      await fetchSignals()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  async function selectDbc(filename: string) {
    isLoading.value = true
    error.value = null
    try {
      const formData = new FormData()
      formData.append('filename', filename)
      
      const baseUrl = await getVisualizerBase()
      const res = await fetch(`${baseUrl}/api/dbc/select`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Select failed')
      }
      
      await fetchDbcs()
      await fetchSignals()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  async function deleteDbc(filename: string) {
    isLoading.value = true
    error.value = null
    try {
      const baseUrl = await getVisualizerBase()
      const res = await fetch(`${baseUrl}/api/dbc/${filename}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Delete failed')
      }
      
      await fetchDbcs()
      await fetchSignals()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  return {
    availableDbcs,
    activeDbc,
    signals,
    isLoading,
    error,
    fetchDbcs,
    fetchSignals,
    uploadDbc,
    selectDbc,
    deleteDbc
  }
})
