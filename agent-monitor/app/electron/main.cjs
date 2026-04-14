const { app, BrowserWindow, Menu, session } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const WINDOW_STATE_FILE = 'window-state.json';

function readWindowState() {
  try {
    const statePath = path.join(app.getPath('userData'), WINDOW_STATE_FILE);
    if (!fs.existsSync(statePath)) return null;
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeWindowState(win) {
  try {
    const bounds = win.getBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: win.isMaximized(),
    };
    const statePath = path.join(app.getPath('userData'), WINDOW_STATE_FILE);
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // ignore persistence failures
  }
}

function createWindow() {
  const state = readWindowState();
  const options = {
    width: state?.width || 1280,
    height: state?.height || 800,
    x: Number.isFinite(state?.x) ? state.x : undefined,
    y: Number.isFinite(state?.y) ? state.y : undefined,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#e2e8f0',
      height: 32,
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: !isDev,
    },
  };

  const win = new BrowserWindow(options);
  if (state?.isMaximized) {
    win.maximize();
  }

  win.on('close', () => {
    writeWindowState(win);
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
