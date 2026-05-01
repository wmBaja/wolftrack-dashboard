export {}

declare global {
  interface Window {
    electronAPI: {
      sendMessage: (message: unknown) => void
      onMessage: (callback: (args: unknown) => void) => void
      openFile: (filters: Electron.FileFilter[]) => Promise<string | null>
      getBackendPort: () => Promise<number>
    } | undefined
  }
}
