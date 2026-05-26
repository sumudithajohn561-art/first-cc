const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pomodoroAPI', {
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks),
  loadTasks: () => ipcRenderer.invoke('load-tasks'),
  saveStats: (stats) => ipcRenderer.invoke('save-stats', stats),
  loadStats: () => ipcRenderer.invoke('load-stats'),
  notify: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  onBeforeClose: (callback) => ipcRenderer.on('before-close', callback),
  confirmClose: () => ipcRenderer.send('close-confirmed'),

  // Settings
  getSetting: (key, defaultValue) => ipcRenderer.invoke('get-setting', key, defaultValue),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Obsidian report (read-only)
  readReportFile: (vaultPath, dailyPath, dateStr) => ipcRenderer.invoke('read-report-file', vaultPath, dailyPath, dateStr),
  writeReportFile: (vaultPath, dailyPath, dateStr, content) => ipcRenderer.invoke('write-report-file', vaultPath, dailyPath, dateStr, content),

  // File watching
  watchReportFile: (vaultPath, dailyPath, dateStr) => ipcRenderer.invoke('watch-report-file', vaultPath, dailyPath, dateStr),
  unwatchFile: () => ipcRenderer.invoke('unwatch-file'),
  onFileChanged: (callback) => ipcRenderer.on('file-changed', (_event, dateStr) => callback(dateStr)),
});
