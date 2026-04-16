import path from 'path'
import { app, BrowserWindow, ipcMain, dialog } from 'electron'

const __filename = new URL('', import.meta.url).pathname;
const __dirname = path.dirname(__filename);

// Check if running in development
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Use __dirname so the preload path is absolute both in dev and when packaged.
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // In development, load from dev server
  // In production, load from built files
  if (isDev) {
    win.loadURL('http://localhost:3000'); // Adjust port to match your Vue dev server
    win.webContents.openDevTools();
  } else {
    const indexPath = app.isPackaged
      ? path.join(process.resourcesPath, 'dist', 'index.html')
      : path.join(__dirname, '../dist/index.html');
    win.loadFile(indexPath);
  }
}

// Handle file open dialog requests from the renderer
ipcMain.handle('dialog:openFile', async (_event, filters) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
