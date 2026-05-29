const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// 单实例锁：防止多个番茄钟同时运行
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

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
    if (isQuitting) return;
    e.preventDefault();
    // 隐藏到后台，而非退出。Obsidian 进程监控负责在 Obsidian 关闭时真正退出。
    mainWindow.hide();
  });
}

// 当第二个实例尝试启动时，聚焦已有窗口
app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  startObsidianMonitor();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- Obsidian 进程绑定（异步版，不阻塞渲染进程） ---
let obsidianMonitorActive = false;
let obsidianMonitorTimeout = null;
let obsidianWasRunning = false;

function isObsidianRunning() {
  return new Promise((resolve) => {
    // 使用 PowerShell Get-Process，比 tasklist 更可靠（避免编码问题）
    exec(
      'powershell -NoProfile -Command "if (Get-Process -Name Obsidian -ErrorAction SilentlyContinue) { \'RUNNING\' }"',
      (err, stdout) => {
        if (err) { resolve(false); return; }
        resolve(stdout.includes('RUNNING'));
      }
    );
  });
}

function doQuit() {
  if (isQuitting) return;
  isQuitting = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('obsidian-closed');
  }
  app.quit();
}

async function obsidianMonitorTick() {
  if (!obsidianMonitorActive) return;
  try {
    const running = await isObsidianRunning();
    if (!obsidianWasRunning && running) {
      // Obsidian 启动了 → 显示番茄钟
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    }
    if (obsidianWasRunning && !running) {
      // Obsidian 关闭了 → 退出番茄钟
      doQuit();
      return; // 不再继续调度
    }
    obsidianWasRunning = running;
  } catch {
    // 检测失败时忽略，保持上次状态
  }
  if (obsidianMonitorActive) {
    obsidianMonitorTimeout = setTimeout(obsidianMonitorTick, 5000);
  }
}

function startObsidianMonitor() {
  obsidianMonitorActive = true;
  if (obsidianMonitorTimeout) clearTimeout(obsidianMonitorTimeout);
  // 首次立即检测 Obsidian 状态，然后每5秒轮询
  obsidianMonitorTimeout = setTimeout(obsidianMonitorTick, 0);
}

// Mini mode state
let miniModeBounds = null;

// IPC handlers
ipcMain.handle('save-tasks', (_e, tasks) => { writeJSON('tasks.json', tasks); });
ipcMain.handle('load-tasks', () => readJSON('tasks.json') || []);
ipcMain.handle('save-stats', (_e, stats) => { writeJSON('stats.json', stats); });
ipcMain.handle('load-stats', () => readJSON('stats.json') || { daily: {} });

ipcMain.handle('set-mini-mode', (_e, enabled) => {
  if (!mainWindow) return;
  if (enabled) {
    miniModeBounds = mainWindow.getBounds();
    mainWindow.setMinimumSize(280, 50);
    mainWindow.setSize(320, 70);
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.center();
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(800, 500);
    if (miniModeBounds) {
      mainWindow.setBounds(miniModeBounds);
      miniModeBounds = null;
    } else {
      mainWindow.setSize(1024, 680);
      mainWindow.center();
    }
  }
});

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

// Write daily report file
ipcMain.handle('write-report-file', (_e, vaultPath, dailyPath, dateStr, content) => {
  try {
    const filePath = getReportPath(vaultPath, dailyPath, dateStr);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

// Create daily report from template if it doesn't exist
ipcMain.handle('ensure-daily-report', (_e, vaultPath, dailyPath, dateStr) => {
  try {
    const reportPath = getReportPath(vaultPath, dailyPath, dateStr);
    if (fs.existsSync(reportPath)) return true;

    const templatePath = path.join(vaultPath, '通用', 'templates', 'Templates_daily.md');
    if (!fs.existsSync(templatePath)) return false;

    let template = fs.readFileSync(templatePath, 'utf-8');
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekday = now.getDay();

    template = template.replace(/^created:.*/m, `created: ${todayStr}T09:00:00`);
    template = template.replace(/^Deadline:.*/m, `Deadline: ${todayStr}T23:59:00`);
    template = template.replace(/^weekday:.*/m, `weekday: ${weekday}`);

    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(reportPath, template, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

// --- File watcher ---
let activeWatchInterval = null;
let activeWatchPath = null;
let activeWatchMtime = 0;

ipcMain.handle('watch-report-file', (_e, vaultPath, dailyPath, dateStr) => {
  if (activeWatchInterval) {
    clearInterval(activeWatchInterval);
    activeWatchInterval = null;
  }
  const filePath = getReportPath(vaultPath, dailyPath, dateStr);
  if (!fs.existsSync(filePath)) return false;
  activeWatchPath = filePath;
  activeWatchMtime = fs.statSync(filePath).mtimeMs;
  activeWatchInterval = setInterval(() => {
    try {
      if (!fs.existsSync(activeWatchPath)) return;
      const mtime = fs.statSync(activeWatchPath).mtimeMs;
      if (mtime > activeWatchMtime) {
        activeWatchMtime = mtime;
        if (mainWindow) {
          mainWindow.webContents.send('file-changed', dateStr);
        }
      }
    } catch { /* file may be temporarily locked */ }
  }, 2000);
  return true;
});

ipcMain.handle('unwatch-file', () => {
  if (activeWatchInterval) {
    clearInterval(activeWatchInterval);
    activeWatchInterval = null;
  }
  activeWatchPath = null;
});
