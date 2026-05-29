// --- Bootstrap ---
const timer = new Timer();
const taskManager = new TaskManager();
const statsTracker = new StatsTracker();

let activeTaskId = null;
let _pendingQuickRecordTaskId = null;
let _pendingCompleteTask = null;
let markdownSync = null;
let currentSyncDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
let dailyGoal = 12;
let reminderTime = '';
let reminderFiredToday = false;
let taskReminderMinutes = 5;
let _taskReminderFiredForTask = null;
let _idleGentleFiredForTask = null;
let _idleUrgentFiredForTask = null;
let _idleUrgentShown = false;
let isMiniMode = false;
let autoContinue = false;
let _breakTipIndex = 0;
let _breakTipInterval = null;
let taskStartReminderMinutes = 5;
let _upcomingTaskRemindedFor = null;

const BREAK_TIPS = [
  '站起来走动一下，活动筋骨',
  '看看窗外远处 20 秒，放松眼睛',
  '喝杯水，补充水分',
  '做几个肩部拉伸，缓解肩颈疲劳',
  '深呼吸 5 次，让大脑充分休息',
  '闭眼休息 30 秒，缓解眼疲劳',
  '站起来扭扭腰，活动脊椎',
  '整理一下桌面，保持整洁',
  '想想接下来要做的事，做好准备',
  '做几个深蹲，促进血液循环',
];

// === DOM refs ===
const el = {
  timerMins: document.getElementById('timer-minutes'),
  timerSecs: document.getElementById('timer-seconds'),
  progressCircle: document.getElementById('progress-circle'),
  sessionBadge: document.getElementById('session-badge'),
  sessionCounter: document.getElementById('session-counter'),
  currentDate: document.getElementById('current-date'),
  activeTaskLabel: document.getElementById('active-task-label'),
  btnStart: document.getElementById('btn-start'),
  btnPause: document.getElementById('btn-pause'),
  btnReset: document.getElementById('btn-reset'),
  btnSkip: document.getElementById('btn-skip'),
  taskTbody: document.getElementById('task-tbody'),
  taskCount: document.getElementById('task-count'),
  btnSyncObsidian: document.getElementById('btn-sync-obsidian'),
  statToday: document.getElementById('stat-today'),
  statWeek: document.getElementById('stat-week'),
  statTotal: document.getElementById('stat-total'),
  focusRating: document.getElementById('focus-rating'),
  btnToggleSettings: document.getElementById('btn-toggle-settings'),
  settingsOverlay: document.getElementById('settings-overlay'),
  settingFocus: document.getElementById('setting-focus'),
  settingBreak: document.getElementById('setting-break'),
  settingLongBreak: document.getElementById('setting-long-break'),
  settingInterval: document.getElementById('setting-interval'),
  settingVault: document.getElementById('setting-vault'),
  settingDailyPath: document.getElementById('setting-daily-path'),
  settingDailyGoal: document.getElementById('setting-daily-goal'),
  settingReminderTime: document.getElementById('setting-reminder-time'),
  settingTaskReminder: document.getElementById('setting-task-reminder'),
  settingTaskStartReminder: document.getElementById('setting-task-start-reminder'),
  goalDots: document.getElementById('goal-dots'),
  goalLabel: document.getElementById('goal-label'),
  btnDistraction: document.getElementById('btn-distraction'),
  distractionCount: document.getElementById('distraction-count'),
  quickRecordOverlay: document.getElementById('quick-record-overlay'),
  quickRecordInput: document.getElementById('quick-record-input'),
  quickRecordOvertimeHint: document.getElementById('quick-record-overtime-hint'),
  btnQuickSave: document.getElementById('btn-quick-save'),
  btnQuickSkip: document.getElementById('btn-quick-skip'),
  taskCompleteOverlay: document.getElementById('task-complete-overlay'),
  taskCompleteTitle: document.getElementById('task-complete-title'),
  taskCompleteRecords: document.getElementById('task-complete-records'),
  taskCompleteStudyFields: document.getElementById('task-complete-study-fields'),
  taskCompleteWorkFields: document.getElementById('task-complete-work-fields'),
  taskCompleteSummary: document.getElementById('task-complete-summary'),
  taskFieldProgress: document.getElementById('task-field-progress'),
  taskFieldIssues: document.getElementById('task-field-issues'),
  taskFieldNextSteps: document.getElementById('task-field-next-steps'),
  taskFieldResources: document.getElementById('task-field-resources'),
  btnTaskCompleteSave: document.getElementById('btn-task-complete-save'),
  btnTaskCompleteCancel: document.getElementById('btn-task-complete-cancel'),
  taskReviewOverlay: document.getElementById('task-review-overlay'),
  taskReviewTitle: document.getElementById('task-review-title'),
  taskReviewTime: document.getElementById('task-review-time'),
  taskReviewPomos: document.getElementById('task-review-pomos'),
  taskReviewRecords: document.getElementById('task-review-records'),
  taskReviewStudyFields: document.getElementById('task-review-study-fields'),
  taskReviewWorkFields: document.getElementById('task-review-work-fields'),
  taskReviewSummary: document.getElementById('task-review-summary'),
  taskReviewProgress: document.getElementById('task-review-progress'),
  taskReviewIssues: document.getElementById('task-review-issues'),
  taskReviewNextSteps: document.getElementById('task-review-next-steps'),
  taskReviewResources: document.getElementById('task-review-resources'),
  btnTaskReviewClose: document.getElementById('btn-task-review-close'),
  btnToggleMini: document.getElementById('btn-toggle-mini'),
  miniBar: document.getElementById('mini-bar'),
  miniTimer: document.getElementById('mini-timer'),
  miniBadge: document.getElementById('mini-badge'),
  miniTaskLabel: document.getElementById('mini-task-label'),
  btnMiniRestore: document.getElementById('btn-mini-restore'),
  autoContinueCheckbox: document.getElementById('auto-continue-checkbox'),
  breakTip: document.getElementById('break-tip'),
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 80;

// ====================================================================
//  TIMER CALLBACKS
// ====================================================================

timer.onTick = () => {
  el.timerMins.textContent = String(timer.minutes).padStart(2, '0');
  el.timerSecs.textContent = String(timer.seconds).padStart(2, '0');
  el.miniTimer.textContent = `${String(timer.minutes).padStart(2, '0')}:${String(timer.seconds).padStart(2, '0')}`;
  const offset = RING_CIRCUMFERENCE * (1 - timer.percentRemaining);
  el.progressCircle.style.strokeDashoffset = offset;
  document.title = `${el.timerMins.textContent}:${el.timerSecs.textContent} - Pomodoro`;
  checkTaskReminder();
};

timer.onSessionChange = () => {
  el.sessionCounter.textContent = timer.sessionDisplay;
  el.sessionBadge.textContent =
    timer.sessionType === 'focus' ? 'Focus' :
    timer.sessionType === 'break' ? 'Break' : 'Long Break';
  el.sessionBadge.className =
    timer.sessionType === 'focus' ? 'badge-focus' :
    timer.sessionType === 'break' ? 'badge-break' : 'badge-long-break';
  el.miniBadge.textContent = el.sessionBadge.textContent;
  el.miniBadge.className = el.sessionBadge.className;
  el.progressCircle.classList.toggle('break', timer.sessionType === 'break');
  el.progressCircle.classList.toggle('long-break', timer.sessionType === 'longBreak');
  updateButtonStates();
  updateActiveTaskLabel();
  updateBreakTip();
};

timer.onDone = (sessionType, minutes) => {
  if (sessionType === 'focus') {
    statsTracker.recordPomodoro(minutes, timer.settings.breakMinutes);
    renderStats();
    renderGoalProgress();
    if (activeTaskId) {
      taskManager.incrementPomodoro(activeTaskId);
      renderTasks();
    }
    pomodoroAPI.notify('Focus Complete!', `Time for a break.`);
  } else {
    pomodoroAPI.notify('Break Over!', 'Ready to start the next focus session.');
  }
  playTickSound();

  setTimeout(() => {
    if (timer.state === 'done') {
      timer._advanceSession();
      timer.state = 'idle';
      updateButtonStates();
      updateActiveTaskLabel();
      if (timer.onTick) timer.onTick();
      if (timer.onSessionChange) timer.onSessionChange();

      if (sessionType === 'focus') {
        showQuickRecord();
        syncFrontmatterToObsidian();
      } else if (autoContinue) {
        // Auto-start next session after break
        setTimeout(() => {
          autoMatchTask();
          _resetReminders();
          timer.start();
          updateButtonStates();
          updateActiveTaskLabel();
        }, 500);
      }
    }
  }, 3000);

  updateButtonStates();
};

// ====================================================================
//  BUTTON STATES
// ====================================================================

function updateButtonStates() {
  const s = timer.state;
  const running = s === 'running';
  el.btnStart.disabled = running || s === 'done' || s === 'paused';
  el.btnPause.disabled = s === 'idle' || s === 'done';
  el.btnPause.textContent = s === 'paused' ? 'Resume' : 'Pause';
  if (s === 'paused') {
    el.btnPause.classList.add('btn-primary');
    el.btnPause.classList.remove('btn-secondary');
  } else {
    el.btnPause.classList.remove('btn-primary');
    el.btnPause.classList.add('btn-secondary');
  }
}

function updateActiveTaskLabel() {
  if (activeTaskId && timer.state === 'running') {
    const task = taskManager.tasks.find(t => t.id === activeTaskId);
    el.activeTaskLabel.textContent = task ? `Focusing: ${task.text}` : '';
  } else {
    el.activeTaskLabel.textContent = '';
  }
  updateMiniTaskLabel();
}

// ====================================================================
//  BUTTON BINDINGS
// ====================================================================

function autoMatchTask() {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  // 找到所有匹配当前时间的任务，优先选时间段最窄的（子任务比父任务更具体）
  const matches = taskManager.tasks.filter(t => {
    if (t.completed || !t.timeSlot) return false;
    const m = t.timeSlot.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!m) return false;
    return cur >= parseInt(m[1]) * 60 + parseInt(m[2])
        && cur <= parseInt(m[3]) * 60 + parseInt(m[4]);
  });
  if (matches.length > 0) {
    // 选时间段最短的（最精确匹配，优先子任务）
    matches.sort((a, b) => {
      const durA = timeSlotToEndMinutes(a.timeSlot) - timeSlotToMinutes(a.timeSlot);
      const durB = timeSlotToEndMinutes(b.timeSlot) - timeSlotToMinutes(b.timeSlot);
      return durA - durB;
    });
    activeTaskId = matches[0].id;
  } else if (activeTaskId) {
    // Check if current active task still matches current time
    const curTask = taskManager.tasks.find(t => t.id === activeTaskId);
    if (curTask && curTask.timeSlot) {
      const m = curTask.timeSlot.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
      if (m) {
        const start = parseInt(m[1]) * 60 + parseInt(m[2]);
        const end = parseInt(m[3]) * 60 + parseInt(m[4]);
        if (cur < start || cur > end) activeTaskId = null;
      }
    } else {
      activeTaskId = null;
    }
  }
  renderTasks();
}

function _resetReminders() {
  _taskReminderFiredForTask = null;
  _idleGentleFiredForTask = null;
  _idleUrgentFiredForTask = null;
  _idleUrgentShown = false;
  _upcomingTaskRemindedFor = null;
}

el.btnStart.addEventListener('click', () => { autoMatchTask(); _resetReminders(); timer.start(); renderTasks(); updateButtonStates(); updateActiveTaskLabel(); });
el.btnPause.addEventListener('click', () => {
  if (timer.state === 'paused') { _resetReminders(); timer.resume(); }
  else timer.pause();
  updateButtonStates();
});
el.btnReset.addEventListener('click', () => { _resetReminders(); timer.reset(); updateButtonStates(); updateActiveTaskLabel(); });
el.btnSkip.addEventListener('click', () => { timer.skip(); updateButtonStates(); updateActiveTaskLabel(); });

// ====================================================================
//  SOUND
// ====================================================================

function playTickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* audio not available */ }
}

// ====================================================================
//  TASK TABLE RENDERING
// ====================================================================

function timeSlotToMinutes(ts) {
  if (!ts) return 0;
  const m = ts.match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
}

function timeSlotToEndMinutes(ts) {
  if (!ts) return 0;
  const m = ts.match(/(\d{1,2}):(\d{2})$/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
}

function getFocusMinutes() {
  try {
    const raw = localStorage.getItem('pomodoro-settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.focusMinutes && s.focusMinutes > 0) return s.focusMinutes;
    }
  } catch { /* ignore */ }
  return 25;
}

function renderTasks() {
  el.taskTbody.innerHTML = '';

  // 构建父子树结构
  const parentMap = new Map();
  const childrenMap = new Map();

  for (const task of taskManager.tasks) {
    if (task.isSubtask && task.parentId) {
      if (!childrenMap.has(task.parentId)) childrenMap.set(task.parentId, []);
      childrenMap.get(task.parentId).push(task);
    }
    parentMap.set(task.id, task);
  }

  // 排序父任务
  const sortedParents = [...parentMap.values()]
    .filter(t => !t.isSubtask)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.timeSlot && !b.timeSlot) return -1;
      if (!a.timeSlot && b.timeSlot) return 1;
      if (a.timeSlot && b.timeSlot) return timeSlotToMinutes(a.timeSlot) - timeSlotToMinutes(b.timeSlot);
      return 0;
    });

  // 展平：父任务后紧跟其子任务
  const sorted = [];
  for (const parent of sortedParents) {
    sorted.push({ task: parent, depth: 0, hasChildren: childrenMap.has(parent.id) });
    const children = (childrenMap.get(parent.id) || []).sort((a, b) => {
      if (a.timeSlot && b.timeSlot) return timeSlotToMinutes(a.timeSlot) - timeSlotToMinutes(b.timeSlot);
      return 0;
    });
    for (const child of children) {
      sorted.push({ task: child, depth: 1, hasChildren: false });
    }
  }

  // 追加无父任务的孤立子任务
  for (const task of taskManager.tasks) {
    if (task.isSubtask && !sorted.some(s => s.task.id === task.id)) {
      sorted.push({ task: task, depth: 1, hasChildren: false });
    }
  }

  const focusMin = getFocusMinutes();

  for (const { task, depth, hasChildren } of sorted) {
    const tr = document.createElement('tr');
    if (task.completed) tr.classList.add('task-done');
    if (task.id === activeTaskId) tr.classList.add('active-task');
    if (depth === 0 && hasChildren) tr.classList.add('task-parent');
    if (depth === 1) tr.classList.add('task-child');

    // Checkbox
    const tdCheck = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'task-checkbox';
    cb.checked = task.completed;
    if (task.completed) {
      cb.disabled = true;
    } else {
      cb.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (task.timeSlot) {
          const cur = new Date().getHours() * 60 + new Date().getMinutes();
          const start = timeSlotToMinutes(task.timeSlot);
          const end = timeSlotToEndMinutes(task.timeSlot);
          if (cur < start) {
            pomodoroAPI.notify('任务未开启', `${task.text}\n时间段: ${task.timeSlot}`);
            cb.checked = false;
            return;
          }
          if (cur > end && task.completedPomodoros === 0) {
            pomodoroAPI.notify('任务已过期', `${task.text}\n该任务未完成任何番茄，请删除或重新安排时间`);
            cb.checked = false;
            return;
          }
        }
        showTaskCompleteModal(task);
        cb.checked = false; // revert browser auto-toggle, wait for modal save
      });
    }
    tdCheck.appendChild(cb);

    // Time
    const tdTime = document.createElement('td');
    tdTime.className = 'cell-time';
    tdTime.textContent = task.timeSlot || '--:--';

    // Priority
    const tdPri = document.createElement('td');
    tdPri.className = 'cell-pri';
    tdPri.textContent = task.priorityEmoji || '';

    // Task name
    const tdTask = document.createElement('td');
    tdTask.className = 'cell-task' + (task.completed ? ' completed' : '');
    if (depth === 1) tdTask.classList.add('cell-task-child');
    // 去除子任务名称中的父任务前缀，只显示支线任务名
    let displayText = task.text;
    if (depth === 1 && task.parentId) {
      const parent = parentMap.get(task.parentId);
      if (parent) {
        const prefix = `${parent.text} (`;
        if (displayText.startsWith(prefix)) {
          displayText = displayText.slice(prefix.length).replace(/\)$/, '');
        }
      }
    }
    tdTask.textContent = displayText;
    tdTask.title = task.text;

    // Pomodoros
    const tdPomos = document.createElement('td');
    tdPomos.className = 'cell-pomos';
    if (task.totalPomodoros > 0) {
      tdPomos.textContent = `${task.completedPomodoros}/${task.totalPomodoros}`;
      // 显示时间余量提示
      if (task.estimatedMinutes && focusMin > 0) {
        const remainder = task.estimatedMinutes % focusMin;
        if (remainder > 0) {
          tdPomos.title = `${task.estimatedMinutes}分钟 / ${focusMin}分钟专注 = ${task.totalPomodoros}番茄 (余${remainder}分钟)`;
        } else {
          tdPomos.title = `${task.estimatedMinutes}分钟 / ${focusMin}分钟专注`;
        }
      }
    } else {
      tdPomos.textContent = '--';
      tdPomos.style.color = 'var(--text-muted)';
    }

    // Status
    const tdStatus = document.createElement('td');
    tdStatus.className = 'cell-status';
    if (task.completed) {
      tdStatus.textContent = 'Done';
      tdStatus.classList.add('status-done');
    } else if (task.id === activeTaskId && (timer.state === 'running' || timer.state === 'paused')) {
      const isOvertime = task.timeSlot && timeSlotToEndMinutes(task.timeSlot) > 0 &&
        new Date().getHours() * 60 + new Date().getMinutes() > timeSlotToEndMinutes(task.timeSlot);
      if (isOvertime) {
        tdStatus.textContent = 'Overtime';
        tdStatus.classList.add('status-overtime');
      } else if (timer.state === 'running') {
        tdStatus.textContent = 'Running';
        tdStatus.classList.add('status-active');
      } else {
        tdStatus.textContent = 'Paused';
        tdStatus.classList.add('status-active');
      }
    } else {
      tdStatus.textContent = 'Pending';
      tdStatus.classList.add('status-pending');
    }

    // Delete
    const tdDel = document.createElement('td');
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-task-del';
    btnDel.textContent = '×';
    btnDel.title = 'Delete task';
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (task.id === activeTaskId) activeTaskId = null;
      taskManager.remove(task.id);
      renderTasks();
    });
    tdDel.appendChild(btnDel);

    // Click row → set active task or view completed task details
    tr.addEventListener('click', () => {
      if (task.completed) {
        showTaskReviewModal(task);
        return;
      }
      if (task.timeSlot) {
        const cur = new Date().getHours() * 60 + new Date().getMinutes();
        const start = timeSlotToMinutes(task.timeSlot);
        if (cur < start) {
          pomodoroAPI.notify('任务未开启', `${task.text}\n时间段: ${task.timeSlot}`);
          return;
        }
      }
      activeTaskId = activeTaskId === task.id ? null : task.id;
      updateActiveTaskLabel();
      renderTasks();
    });

    tr.append(tdCheck, tdTime, tdPri, tdTask, tdPomos, tdStatus, tdDel);
    el.taskTbody.appendChild(tr);
  }
  el.taskCount.textContent = taskManager.activeCount;
}

// ====================================================================
//  SYNC FROM OBSIDIAN
// ====================================================================

let _syncFeedbackTimer = null;

el.btnSyncObsidian.addEventListener('click', async () => {
  if (!markdownSync || !markdownSync.vaultPath) {
    alert('Please configure your Obsidian Vault path in Settings first.');
    return;
  }
  clearTimeout(_syncFeedbackTimer);
  el.btnSyncObsidian.textContent = 'Syncing...';
  el.btnSyncObsidian.disabled = true;
  const ok = await markdownSync.readFromVault(currentSyncDate);
  if (timer.state === 'running' || timer.state === 'paused') autoMatchTask();
  renderTasks();
  el.btnSyncObsidian.textContent = ok ? 'Synced ✓' : 'No report found';
  el.btnSyncObsidian.disabled = false;
  _syncFeedbackTimer = setTimeout(() => {
    el.btnSyncObsidian.textContent = 'Sync from Obsidian';
    _syncFeedbackTimer = null;
  }, 5000);
});

// ====================================================================
//  STATS
// ====================================================================

function renderStats() {
  const today = statsTracker.getTodayStats();
  const week = statsTracker.getWeekStats();
  const total = statsTracker.getTotalStats();
  el.statToday.textContent = today.completedPomodoros;
  el.statWeek.textContent = week.completedPomodoros;
  el.statTotal.textContent = total.completedPomodoros;
  renderFocusRating();
}

function renderFocusRating() {
  const today = statsTracker.getTodayStats();
  const distractions = today.distractions || 0;
  const completed = today.completedPomodoros || 0;
  const rate = dailyGoal > 0 ? Math.max(0, (completed - distractions) / dailyGoal) * 100 : 0;
  el.focusRating.textContent = rateToStars(rate);
}

// ====================================================================
//  GOAL PROGRESS
// ====================================================================

function renderGoalProgress() {
  const completed = statsTracker.getTodayStats().completedPomodoros;
  el.goalDots.innerHTML = '';

  for (let i = 0; i < dailyGoal; i++) {
    const dot = document.createElement('span');
    dot.className = 'goal-dot' + (i < completed ? ' filled' : '');
    el.goalDots.appendChild(dot);
  }

  if (completed > dailyGoal) {
    const extra = document.createElement('span');
    extra.className = 'goal-dot overflow';
    el.goalDots.appendChild(extra);
  }

  el.goalLabel.textContent = `${completed} / ${dailyGoal}`;
}

// ====================================================================
//  DISTRACTION COUNTER
// ====================================================================

function renderDistractionCount() {
  el.distractionCount.textContent = statsTracker.getTodayDistractions();
}

el.btnDistraction.addEventListener('click', () => {
  statsTracker.recordDistraction();
  renderDistractionCount();
  renderFocusRating();
  el.btnDistraction.classList.remove('flash');
  void el.btnDistraction.offsetWidth;
  el.btnDistraction.classList.add('flash');
});

// ====================================================================
//  QUICK RECORD OVERLAY
// ====================================================================

function showQuickRecord() {
  _pendingQuickRecordTaskId = activeTaskId;
  el.quickRecordOverlay.classList.remove('hidden');
  el.quickRecordInput.value = '';
  // Show overtime hint if active task has exceeded its time slot
  if (activeTaskId) {
    const task = taskManager.tasks.find(t => t.id === activeTaskId);
    if (task && task.timeSlot) {
      const end = timeSlotToEndMinutes(task.timeSlot);
      const cur = new Date().getHours() * 60 + new Date().getMinutes();
      if (end > 0 && cur > end) {
        const overtimeMins = cur - end;
        el.quickRecordOvertimeHint.textContent = `该任务超时约 ${overtimeMins} 分钟完成，建议在 Obsidian 中更新时间段`;
        el.quickRecordOvertimeHint.classList.remove('hidden');
      } else {
        el.quickRecordOvertimeHint.classList.add('hidden');
      }
    } else {
      el.quickRecordOvertimeHint.classList.add('hidden');
    }
  } else {
    el.quickRecordOvertimeHint.classList.add('hidden');
  }
  el.quickRecordInput.focus();
}

function hideQuickRecord() {
  el.quickRecordOverlay.classList.add('hidden');
  el.quickRecordInput.value = '';
  el.quickRecordOvertimeHint.classList.add('hidden');
  _pendingQuickRecordTaskId = null;
}

function _afterQuickRecord() {
  hideQuickRecord();
  if (autoContinue) {
    setTimeout(() => {
      _resetReminders();
      timer.start();
      updateButtonStates();
      updateActiveTaskLabel();
    }, 300);
  }
}

el.btnQuickSave.addEventListener('click', () => {
  const text = el.quickRecordInput.value.trim();
  if (text) {
    statsTracker.recordQuickNote(text, _pendingQuickRecordTaskId);
  }
  _afterQuickRecord();
});

el.btnQuickSkip.addEventListener('click', () => {
  _afterQuickRecord();
});

el.quickRecordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    el.btnQuickSave.click();
  } else if (e.key === 'Escape') {
    hideQuickRecord();
  }
});

// ====================================================================
//  TASK COMPLETION MODAL
// ====================================================================

function showTaskCompleteModal(task) {
  _pendingCompleteTask = task;
  el.taskCompleteOverlay.classList.remove('hidden');
  el.taskCompleteTitle.textContent = `Complete: ${task.text}`;

  const records = statsTracker.getTaskQuickRecords(task.id);
  const recordsDiv = el.taskCompleteRecords;
  recordsDiv.innerHTML = '';
  if (records.length > 0) {
    records.forEach(r => {
      const div = document.createElement('div');
      div.className = 'task-record-item';
      const t = new Date(r.time);
      const ts = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      div.innerHTML = `<span class="task-record-time">${ts}</span>${r.text}`;
      recordsDiv.appendChild(div);
    });
  }

  if (task.text.includes('项目')) {
    el.taskCompleteStudyFields.classList.add('hidden');
    el.taskCompleteWorkFields.classList.remove('hidden');
    el.taskFieldProgress.value = '';
    el.taskFieldIssues.value = '';
    el.taskFieldNextSteps.value = '';
    el.taskFieldResources.value = '';
    el.taskFieldProgress.focus();
  } else {
    el.taskCompleteWorkFields.classList.add('hidden');
    el.taskCompleteStudyFields.classList.remove('hidden');
    el.taskCompleteSummary.value = '';
    el.taskCompleteSummary.focus();
  }
}

function hideTaskCompleteModal() {
  el.taskCompleteOverlay.classList.add('hidden');
  el.taskCompleteSummary.value = '';
  el.taskFieldProgress.value = '';
  el.taskFieldIssues.value = '';
  el.taskFieldNextSteps.value = '';
  el.taskFieldResources.value = '';
  _pendingCompleteTask = null;
}

el.btnTaskCompleteSave.addEventListener('click', async () => {
  const task = _pendingCompleteTask;
  if (!task) return;

  if (task.text.includes('项目')) {
    const progress = el.taskFieldProgress.value.trim();
    if (!progress) {
      el.taskFieldProgress.style.borderColor = 'var(--danger)';
      el.taskFieldProgress.focus();
      return;
    }
    const summary = {
      progress,
      issues: el.taskFieldIssues.value.trim(),
      nextSteps: el.taskFieldNextSteps.value.trim(),
      resources: el.taskFieldResources.value.trim(),
    };
    task.summary = summary;
  } else {
    const summary = el.taskCompleteSummary.value.trim();
    if (!summary) {
      el.taskCompleteSummary.style.borderColor = 'var(--danger)';
      el.taskCompleteSummary.focus();
      return;
    }
    task.summary = summary;
  }

  taskManager._save();
  taskManager.toggle(task.id);
  renderTasks();
  hideTaskCompleteModal();

  if (markdownSync && markdownSync.vaultPath) {
    await markdownSync.writeTaskSummary(currentSyncDate, task);
    await markdownSync.writeTaskCheckbox(currentSyncDate, task, true);
  }
});

el.btnTaskCompleteCancel.addEventListener('click', () => {
  hideTaskCompleteModal();
});

el.taskCompleteSummary.addEventListener('input', () => {
  el.taskCompleteSummary.style.borderColor = '';
});
el.taskFieldProgress.addEventListener('input', () => {
  el.taskFieldProgress.style.borderColor = '';
});

// ====================================================================
//  TASK REVIEW MODAL (read-only)
// ====================================================================

function showTaskReviewModal(task) {
  el.taskReviewOverlay.classList.remove('hidden');
  el.taskReviewTitle.textContent = task.text;
  el.taskReviewTime.textContent = task.timeSlot || '';
  el.taskReviewPomos.textContent = task.totalPomodoros > 0
    ? `🍅 ${task.completedPomodoros}/${task.totalPomodoros}`
    : '';

  const records = statsTracker.getTaskQuickRecords(task.id);
  const recordsDiv = el.taskReviewRecords;
  recordsDiv.innerHTML = '';
  if (records.length > 0) {
    records.forEach(r => {
      const div = document.createElement('div');
      div.className = 'task-record-item';
      const t = new Date(r.time);
      const ts = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      div.innerHTML = `<span class="task-record-time">${ts}</span>${r.text}`;
      recordsDiv.appendChild(div);
    });
  }

  if (task.text.includes('项目') && typeof task.summary === 'object') {
    el.taskReviewStudyFields.classList.add('hidden');
    el.taskReviewWorkFields.classList.remove('hidden');
    el.taskReviewProgress.textContent = task.summary.progress || '(No entry)';
    el.taskReviewIssues.textContent = task.summary.issues || '(No entry)';
    el.taskReviewNextSteps.textContent = task.summary.nextSteps || '(No entry)';
    el.taskReviewResources.textContent = task.summary.resources || '(No entry)';
    // Style empty fields
    [el.taskReviewProgress, el.taskReviewIssues, el.taskReviewNextSteps, el.taskReviewResources].forEach(el => {
      if (el.textContent === '(No entry)') el.style.color = 'var(--text-muted)';
      else el.style.color = '';
    });
  } else {
    el.taskReviewWorkFields.classList.add('hidden');
    el.taskReviewStudyFields.classList.remove('hidden');
    const summary = typeof task.summary === 'object' ? (task.summary.progress || '') : (task.summary || '');
    el.taskReviewSummary.textContent = summary || '(No summary)';
    if (!summary) el.taskReviewSummary.style.color = 'var(--text-muted)';
    else el.taskReviewSummary.style.color = '';
  }
}

el.btnTaskReviewClose.addEventListener('click', () => {
  el.taskReviewOverlay.classList.add('hidden');
});

el.taskReviewOverlay.addEventListener('click', (e) => {
  if (e.target === el.taskReviewOverlay) el.taskReviewOverlay.classList.add('hidden');
});

el.taskCompleteSummary.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    el.btnTaskCompleteSave.click();
  } else if (e.key === 'Escape') {
    hideTaskCompleteModal();
  }
});

// Also bind Ctrl+Enter / Escape for work task structured fields
const _handleWorkFieldKey = (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    el.btnTaskCompleteSave.click();
  } else if (e.key === 'Escape') {
    hideTaskCompleteModal();
  }
};
el.taskFieldProgress.addEventListener('keydown', _handleWorkFieldKey);
el.taskFieldIssues.addEventListener('keydown', _handleWorkFieldKey);
el.taskFieldNextSteps.addEventListener('keydown', _handleWorkFieldKey);
el.taskFieldResources.addEventListener('keydown', _handleWorkFieldKey);

// ====================================================================
//  FRONTMATTER SYNC
// ====================================================================

async function syncFrontmatterToObsidian() {
  if (!markdownSync || !markdownSync.vaultPath) return;
  const today = statsTracker.getTodayStats();
  const focusHours = today.totalFocusMinutes / 60;
  const distractions = today.distractions || 0;
  const completed = today.completedPomodoros || 0;
  // Focus rate: how many pomodoros were distraction-free
  const rate = dailyGoal > 0 ? Math.max(0, (completed - distractions) / dailyGoal) * 100 : 0;
  const starRating = rateToStars(rate);
  await markdownSync.syncFrontmatter(currentSyncDate, focusHours, starRating);
}

function rateToStars(rate) {
  if (rate <= 0) return '☆☆☆☆☆';
  const level = Math.min(5, Math.max(1, Math.ceil(rate / 20)));
  return '★'.repeat(level) + '☆'.repeat(5 - level);
}

// ====================================================================
//  DATE DISPLAY
// ====================================================================

function updateDateDisplay() {
  const now = new Date();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateStr = now.toISOString().slice(0, 10);
  const weekday = weekdays[now.getDay()];
  el.currentDate.textContent = `${dateStr} ${weekday}`;
}

// ====================================================================
//  TASK DEADLINE REMINDER
// ====================================================================

function checkTaskReminder() {
  if (timer.state !== 'running' || !activeTaskId || !taskReminderMinutes) return;
  const task = taskManager.tasks.find(t => t.id === activeTaskId);
  if (!task || !task.timeSlot || task.completed) {
    _taskReminderFiredForTask = null;
    return;
  }
  const end = timeSlotToEndMinutes(task.timeSlot);
  if (!end) return;
  const cur = new Date().getHours() * 60 + new Date().getMinutes();
  const remaining = end - cur;
  if (remaining <= taskReminderMinutes && remaining > 0) {
    if (_taskReminderFiredForTask !== task.id) {
      _taskReminderFiredForTask = task.id;
      pomodoroAPI.notify('任务即将到期', `${task.text}\n还有约 ${remaining} 分钟 (${task.timeSlot} 截止)`);
    }
  } else if (remaining <= 0 && remaining >= -1) {
    // Task time slot just ended but timer is still running
    if (_taskReminderFiredForTask !== 'overtime-' + task.id) {
      _taskReminderFiredForTask = 'overtime-' + task.id;
      pomodoroAPI.notify('任务已超时', `${task.text}\n时间段 ${task.timeSlot} 已结束，计时仍在继续`);
    }
  }
}

// ====================================================================
//  IDLE REMINDER — three-tier: gentle / urgent / deadline
// ====================================================================

function checkIdleReminder() {
  const cur = new Date().getHours() * 60 + new Date().getMinutes();

  // Check ALL incomplete tasks with time slots, not just the active one
  for (const task of taskManager.tasks) {
    if (task.completed || !task.timeSlot) continue;

    // 跳过有子任务的父任务——子任务各自负责提醒，避免父任务重复弹窗
    if (!task.isSubtask && taskManager.tasks.some(t => t.isSubtask && t.parentId === task.id)) continue;

    const start = timeSlotToMinutes(task.timeSlot);
    const end = timeSlotToEndMinutes(task.timeSlot);
    if (!start || !end) continue;

    const idleMinutes = cur - start;
    const totalDuration = end - start;
    const remaining = end - cur;

    // Tier 1 — Gentle: time slot started 10+ min ago, timer not running
    if (idleMinutes >= 10 && timer.state !== 'running' && remaining > 0) {
      if (_idleGentleFiredForTask !== task.id) {
        _idleGentleFiredForTask = task.id;
        pomodoroAPI.notify(
          '任务等待中',
          `「${task.text}」已开始 ${idleMinutes} 分钟，还未启动计时，要开始专注吗？`
        );
      }
    }

    // Tier 2 — Urgent: ≤30% time remaining, zero pomodoros done, timer not running
    if (remaining > 0 && remaining <= totalDuration * 0.3 && task.completedPomodoros === 0 && !_idleUrgentShown) {
      if (_idleUrgentFiredForTask !== task.id) {
        _idleUrgentFiredForTask = task.id;
        _idleUrgentShown = true;
        setTimeout(() => {
          confirm(
            `⏰ 任务即将到期！\n\n「${task.text}」仅剩 ${remaining} 分钟，番茄尚未开始。\n请立即开始专注！\n\n点击确定后请按 Start 开始计时。`
          );
          _idleUrgentShown = false;
        }, 100);
      }
    }

    // Stop after first matching task to avoid spam
    if (_idleGentleFiredForTask || _idleUrgentFiredForTask) break;
  }
}

// ====================================================================
//  UPCOMING TASK REMINDER — warn before next task starts
// ====================================================================

function checkUpcomingTask() {
  if (!taskStartReminderMinutes) return;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();

  // Find incomplete tasks with future time slots, sorted by start time
  const upcoming = taskManager.tasks
    .filter(t => !t.completed && t.timeSlot)
    .map(t => {
      const start = timeSlotToMinutes(t.timeSlot);
      return { task: t, start };
    })
    .filter(({ start }) => start > 0 && start > cur)
    .sort((a, b) => a.start - b.start);

  if (upcoming.length === 0) {
    _upcomingTaskRemindedFor = null;
    return;
  }

  const next = upcoming[0];
  const remaining = next.start - cur;

  if (remaining <= taskStartReminderMinutes && remaining > 0) {
    if (_upcomingTaskRemindedFor !== next.task.id) {
      _upcomingTaskRemindedFor = next.task.id;
      const timeLabel = next.task.timeSlot
        ? next.task.timeSlot.replace(/^0/, '').replace(/-0/, '-')
        : '';
      pomodoroAPI.notify(
        '下一个任务即将开始',
        `「${next.task.text}」将于 ${remaining} 分钟后开始${timeLabel ? '（' + timeLabel + '）' : ''}，请做好准备`
      );
    }
  } else if (remaining > taskStartReminderMinutes) {
    // Task is still far away, clear the reminder flag so it can fire later
    _upcomingTaskRemindedFor = null;
  }
}

// ====================================================================
//  BREAK TIPS
// ====================================================================

function updateBreakTip() {
  clearInterval(_breakTipInterval);
  if (timer.sessionType === 'break' || timer.sessionType === 'longBreak') {
    el.breakTip.textContent = BREAK_TIPS[_breakTipIndex % BREAK_TIPS.length];
    el.breakTip.classList.remove('hidden');
    _breakTipInterval = setInterval(() => {
      _breakTipIndex++;
      el.breakTip.textContent = BREAK_TIPS[_breakTipIndex % BREAK_TIPS.length];
    }, 30000);
  } else {
    el.breakTip.classList.add('hidden');
    _breakTipInterval = null;
  }
}

// ====================================================================
//  DAILY REMINDER
// ====================================================================

function checkReminder() {
  if (!reminderTime) return;
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (hm === reminderTime && !reminderFiredToday) {
    reminderFiredToday = true;
    pomodoroAPI.notify('Daily Summary', 'Time to write your daily summary!');
  }
}

// ====================================================================
//  SETTINGS
// ====================================================================

el.btnToggleSettings.addEventListener('click', () => {
  el.settingsOverlay.classList.toggle('hidden');
});

el.settingsOverlay.addEventListener('click', (e) => {
  if (e.target === el.settingsOverlay) el.settingsOverlay.classList.add('hidden');
});

// ====================================================================
//  MINI MODE
// ====================================================================

el.btnToggleMini.addEventListener('click', () => {
  isMiniMode = !isMiniMode;
  document.body.classList.toggle('mini-mode', isMiniMode);
  el.miniBar.classList.toggle('hidden', !isMiniMode);
  pomodoroAPI.setMiniMode(isMiniMode);
  if (isMiniMode) {
    el.miniTimer.textContent = `${String(timer.minutes).padStart(2, '0')}:${String(timer.seconds).padStart(2, '0')}`;
    el.miniBadge.textContent = el.sessionBadge.textContent;
    el.miniBadge.className = el.sessionBadge.className;
    updateMiniTaskLabel();
  }
});

el.btnMiniRestore.addEventListener('click', () => {
  el.btnToggleMini.click();
});

function updateMiniTaskLabel() {
  if (activeTaskId && timer.state === 'running') {
    const task = taskManager.tasks.find(t => t.id === activeTaskId);
    el.miniTaskLabel.textContent = task ? task.text : '';
  } else {
    el.miniTaskLabel.textContent = '';
  }
}

// ====================================================================
//  AUTO CONTINUE
// ====================================================================

el.autoContinueCheckbox.addEventListener('change', () => {
  autoContinue = el.autoContinueCheckbox.checked;
  localStorage.setItem('pomodoro-auto-continue', autoContinue ? '1' : '0');
});

el.settingFocus.addEventListener('change', () => applySettings());
el.settingBreak.addEventListener('change', () => applySettings());
el.settingLongBreak.addEventListener('change', () => applySettings());
el.settingInterval.addEventListener('change', () => applySettings());

el.settingDailyGoal.addEventListener('change', async () => {
  const g = Math.max(1, Math.min(24, parseInt(el.settingDailyGoal.value) || 12));
  el.settingDailyGoal.value = g;
  dailyGoal = g;
  await pomodoroAPI.setSetting('dailyGoal', g);
  renderGoalProgress();
});

el.settingReminderTime.addEventListener('change', async () => {
  const val = el.settingReminderTime.value.trim();
  reminderTime = /^\d{2}:\d{2}$/.test(val) ? val : '';
  await pomodoroAPI.setSetting('reminderTime', reminderTime);
  reminderFiredToday = false;
});

el.settingTaskReminder.addEventListener('change', async () => {
  const v = Math.max(1, Math.min(30, parseInt(el.settingTaskReminder.value) || 5));
  el.settingTaskReminder.value = v;
  taskReminderMinutes = v;
  await pomodoroAPI.setSetting('taskReminderMinutes', v);
  _resetReminders();
});

el.settingTaskStartReminder.addEventListener('change', async () => {
  const v = Math.max(1, Math.min(30, parseInt(el.settingTaskStartReminder.value) || 5));
  el.settingTaskStartReminder.value = v;
  taskStartReminderMinutes = v;
  await pomodoroAPI.setSetting('taskStartReminderMinutes', v);
  _upcomingTaskRemindedFor = null;
});

function applySettings() {
  const f = Math.max(1, Math.min(60, parseInt(el.settingFocus.value) || 25));
  const b = Math.max(1, Math.min(30, parseInt(el.settingBreak.value) || 5));
  const lb = Math.max(5, Math.min(30, parseInt(el.settingLongBreak.value) || 15));
  const iv = Math.max(2, Math.min(6, parseInt(el.settingInterval.value) || 4));
  el.settingFocus.value = f;
  el.settingBreak.value = b;
  el.settingLongBreak.value = lb;
  el.settingInterval.value = iv;
  timer.saveSettings(f, b, lb, iv);
  el.timerMins.textContent = String(timer.minutes).padStart(2, '0');
  el.timerSecs.textContent = String(timer.seconds).padStart(2, '0');
  el.sessionCounter.textContent = timer.sessionDisplay;
  const offset = RING_CIRCUMFERENCE * (1 - timer.percentRemaining);
  el.progressCircle.style.strokeDashoffset = offset;
  renderTasks();
}

// Vault path change
el.settingVault.addEventListener('change', async () => {
  const vp = el.settingVault.value.trim();
  await pomodoroAPI.setSetting('vaultPath', vp);
  if (markdownSync) {
    markdownSync.vaultPath = vp;
    if (vp) {
      await markdownSync.startWatching(currentSyncDate);
      await markdownSync.readFromVault(currentSyncDate);
      renderTasks();
    } else {
      await pomodoroAPI.unwatchFile();
    }
  }
});

// Daily report path change
el.settingDailyPath.addEventListener('change', async () => {
  const dp = el.settingDailyPath.value.trim();
  await pomodoroAPI.setSetting('dailyPath', dp);
  if (markdownSync) {
    if (markdownSync.vaultPath) await pomodoroAPI.unwatchFile();
    markdownSync.dailyPath = dp || '经验总结/日报';
    if (markdownSync.vaultPath) {
      await markdownSync.startWatching(currentSyncDate);
    }
  }
});

// ====================================================================
//  KEYBOARD SHORTCUTS
// ====================================================================

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (timer.state === 'running') timer.pause();
      else if (timer.state === 'paused') timer.resume();
      else { autoMatchTask(); timer.start(); }
      updateButtonStates();
      updateActiveTaskLabel();
      break;
    case 'KeyR':
      timer.reset();
      updateButtonStates();
      updateActiveTaskLabel();
      break;
    case 'KeyS':
      if (!e.ctrlKey && !e.metaKey) {
        timer.skip();
        updateButtonStates();
        updateActiveTaskLabel();
      }
      break;
  }
});

// ====================================================================
//  CLOSE CONFIRMATION
// ====================================================================

pomodoroAPI.onBeforeClose(() => {
  if (timer.state === 'running' || timer.state === 'paused') {
    const leave = confirm('A timer is still active. Are you sure you want to quit?');
    if (leave) pomodoroAPI.confirmClose();
  } else {
    pomodoroAPI.confirmClose();
  }
});

// ====================================================================
//  INIT
// ====================================================================

async function init() {
  await Promise.all([taskManager.load(), statsTracker.load()]);

  const vaultPath = await pomodoroAPI.getSetting('vaultPath', '');
  const dailyPath = await pomodoroAPI.getSetting('dailyPath', '经验总结/日报');
  dailyGoal = await pomodoroAPI.getSetting('dailyGoal', 12);
  reminderTime = await pomodoroAPI.getSetting('reminderTime', '');
  if (reminderTime && !/^\d{2}:\d{2}$/.test(reminderTime)) reminderTime = '';
  taskReminderMinutes = await pomodoroAPI.getSetting('taskReminderMinutes', 5);
  taskStartReminderMinutes = await pomodoroAPI.getSetting('taskStartReminderMinutes', 5);

  autoContinue = (localStorage.getItem('pomodoro-auto-continue') || '0') === '1';
  el.autoContinueCheckbox.checked = autoContinue;

  el.settingVault.value = vaultPath;
  el.settingDailyPath.value = dailyPath;
  el.settingDailyGoal.value = dailyGoal;
  el.settingReminderTime.value = reminderTime;
  el.settingTaskReminder.value = taskReminderMinutes;
  el.settingTaskStartReminder.value = taskStartReminderMinutes;

  markdownSync = new MarkdownSync(taskManager, vaultPath, dailyPath);
  markdownSync.onTasksChanged = () => renderTasks();

  if (vaultPath) {
    await markdownSync.readFromVault(currentSyncDate);
    await markdownSync.startWatching(currentSyncDate);
  }

  pomodoroAPI.onFileChanged((dateStr) => {
    markdownSync.onExternalChange(dateStr);
  });

  renderTasks();
  renderStats();
  renderGoalProgress();
  renderDistractionCount();
  el.miniTimer.textContent = '25:00';
  el.miniBadge.textContent = 'Focus';
  el.miniBadge.className = 'badge-focus';
  updateDateDisplay();
  updateButtonStates();
  updateActiveTaskLabel();
  if (timer.onTick) timer.onTick();
  if (timer.onSessionChange) timer.onSessionChange();

  // Midnight rollover + reminder check
  setInterval(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10).replace(/-/g, '');
    if (today !== currentSyncDate) {
      currentSyncDate = today;
      reminderFiredToday = false;
      _upcomingTaskRemindedFor = null;
      updateDateDisplay();
      if (markdownSync && markdownSync.vaultPath) {
        markdownSync.switchDate(today);
      }
    }
    checkReminder();
  }, 60000);

  // Idle + upcoming task reminder check — runs every 30s independently of timer state
  setInterval(() => { checkIdleReminder(); checkUpcomingTask(); }, 30000);
}

init();
