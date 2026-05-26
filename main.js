const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(app.getPath('userData'), 'data');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readJSON(filename) {
  ensureDataDir();
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJSON(filename, data) {
  ensureDataDir();
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2), 'utf-8');
}

let mainWindow = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 680,
    minWidth: 800,
    minHeight: 500,
    title: 'Pomodoro Timer',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    if (isQuitting) return; // already confirmed, let it close
    e.preventDefault();
    mainWindow.webContents.send('before-close');
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('save-tasks', (_e, tasks) => { writeJSON('tasks.json', tasks); });
ipcMain.handle('load-tasks', () => readJSON('tasks.json') || []);
ipcMain.handle('save-stats', (_e, stats) => { writeJSON('stats.json', stats); });
ipcMain.handle('load-stats', () => readJSON('stats.json') || { daily: {} });

ipcMain.on('show-notification', (_event, { title, body }) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body, silent: false });
  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  notification.show();
});

ipcMain.on('close-confirmed', () => {
  isQuitting = true;
  app.quit();
});

// --- Settings ---
const SETTINGS_FILE = 'settings.json';

function readSettings() {
  const data = readJSON(SETTINGS_FILE);
  return data || {};
}

function writeSettings(settings) {
  writeJSON(SETTINGS_FILE, settings);
}

ipcMain.handle('get-setting', (_e, key, defaultValue) => {
  const s = readSettings();
  return key in s ? s[key] : defaultValue;
});

ipcMain.handle('set-setting', (_e, key, value) => {
  const s = readSettings();
  s[key] = value;
  writeSettings(s);
});

// --- Obsidian file I/O ---
function getReportPath(vaultPath, dailyPath, dateStr) {
  const dir = path.join(vaultPath, dailyPath);
  return path.join(dir, `${dateStr}.md`);
}

// Read daily report file
ipcMain.handle('read-report-file', (_e, vaultPath, dailyPath, dateStr) => {
  try {
    const filePath = getReportPath(vaultPath, dailyPath, dateStr);
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
});

// Write daily report file (for frontmatter sync only — never touch task sections)
ipcMain.handle('write-report-file', (_e, vaultPath, dailyPath, dateStr, content) => {
  try {
    const filePath = getReportPath(vaultPath, dailyPath, dateStr);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

// --- File watcher (watches the daily report directory) ---
let activeWatcher = null;

ipcMain.handle('watch-report-file', (_e, vaultPath, dailyPath, dateStr) => {
  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
  }
  const dir = path.join(vaultPath, dailyPath);
  if (!fs.existsSync(dir)) return false;
  activeWatcher = fs.watch(dir, (_eventType, filename) => {
    if (filename === `${dateStr}.md` && mainWindow) {
      mainWindow.webContents.send('file-changed', dateStr);
    }
  });
  return true;
});

ipcMain.handle('unwatch-file', () => {
  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
  }
});
