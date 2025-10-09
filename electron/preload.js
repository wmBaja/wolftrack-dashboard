// Use `require` for CommonJS compatibility in the preload script.
// The .cts extension tells TypeScript to treat this as a CommonJS module.
import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message) => ipcRenderer.send('toMain', message),
  onMessage: (callback) => {
    // Deliberately strip the event object from the callback, as it includes `sender`
    ipcRenderer.on('fromMain', (event, args) => callback(args));
  },
});

