export {}

export interface DiscoveryResult {
  ip: string
  port: number
  name?: string
  model?: string
  serial?: string
}

declare global {
  interface Window {
    electronAPI: {
      sendMessage: (message: unknown) => void
      onMessage: (callback: (args: unknown) => void) => void
      openFile: (filters: Electron.FileFilter[]) => Promise<string | null>
      getBackendPort: () => Promise<number>
      discoverDevices: () => Promise<DiscoveryResult[]>
    } | undefined
  }
}
