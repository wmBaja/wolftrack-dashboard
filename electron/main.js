import path from 'path'
import { spawn } from 'child_process'
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'url'

// ─── Discovery (stub) ────────────────────────────────────────────────────────
// Auto-discovery via mDNS/bonjour is implemented here in Electron main process.
// Browser builds cannot do network scanning or mDNS due to security restrictions.
// This stub returns an empty array until a real discovery implementation is added.

/**
 * @typedef {Object} DiscoveryResult
 * @property {string} ip
 * @property {number} port
 * @property {string} [name]
 * @property {string} [model]
 * @property {string} [serial]
 */

/**
 * Discover DAQ devices on the local network.
 * @returns {Promise<DiscoveryResult[]>}
 */
async function discoverDevices() {
  // TODO: Implement mDNS/bonjour discovery using a library like 'bonjour-service'
  // For now, attempt a simple HTTP health check on common DAQ ports on the local subnet
  /** @type {DiscoveryResult[]} */
  const results = []
  const commonPorts = [5000, 8000, 8080, 80]

  // Note: Network scanning from Electron main process is possible but may be slow.
  // A more efficient approach would be server-side broadcast or mDNS.
  // For now, return empty to avoid blocking the UI.
  return results
}

// Register discovery IPC handler
ipcMain.handle('discovery:discoverDevices', async () => {
  return await discoverDevices()
})

const __filename = fileURLToPath(import.meta.url);
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

ipcMain.handle('dialog:openFile', async (_event, filters) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

let backendProcess = null;
let backendPortResolver = null;
const backendPortPromise = new Promise(resolve => { backendPortResolver = resolve; });

ipcMain.handle('get-backend-port', async () => {
  return await backendPortPromise;
});

function startBackend() {
  const isWindows = process.platform === 'win32';
  const executableName = isWindows ? 'wolftrack-visualizer.exe' : 'wolftrack-visualizer';

  let backendPath;
  const userDataPath = app.getPath('userData');
  const backendEnv = {
    ...process.env,
    APP_LOG_DIR: path.join(userDataPath, 'backend_logs'),
    WOLFTRACK_USER_DATA: userDataPath
  };

  if (app.isPackaged) {
    // In production, point to the packaged executable
    const backendDir = path.join(process.resourcesPath, 'backend');
    backendPath = path.join(backendDir, executableName);
    backendProcess = spawn(backendPath, [], {
      cwd: backendDir,
      env: backendEnv
    });
  } else {
    // In development, run the python script directly
    const visualizerDir = process.env.WOLFTRACK_VISUALIZER_DIR || path.join(__dirname, '../../wolftrack-visualizer');
    backendPath = path.join(visualizerDir, 'src/app.py');
    backendProcess = spawn('uv', ['run', 'python', backendPath], {
      cwd: visualizerDir,
      env: backendEnv
    });
  }

  backendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`Backend: ${output}`);

    // Parse the port if needed by your renderer
    if (output.includes('WOLFTRACK_WS_PORT=')) {
      const match = output.match(/WOLFTRACK_WS_PORT=(\d+)/);
      if (match && match[1]) {
        const port = match[1];
        process.env.WOLFTRACK_WS_PORT = port;
        if (backendPortResolver) backendPortResolver(port);
      }
    }
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data.toString()}`);
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
