import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message) => ipcRenderer.send('toMain', message),
  onMessage: (callback) => {
    ipcRenderer.on('fromMain', (event, args) => callback(args))
  },
  openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
})
