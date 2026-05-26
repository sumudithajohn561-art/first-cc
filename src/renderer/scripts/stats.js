class StatsTracker {
  constructor() {
    this.data = { daily: {} };
  }

  async load() {
    this.data = await pomodoroAPI.loadStats();
  }

  _save() {
    pomodoroAPI.saveStats(this.data);
  }

  _ensureDay(today) {
    if (!this.data.daily[today]) {
      this.data.daily[today] = {
        completedPomodoros: 0,
        totalFocusMinutes: 0,
        totalBreakMinutes: 0,
        distractions: 0,
        quickRecords: [],
      };
    }
    return this.data.daily[today];
  }

  recordPomodoro(focusMinutes, breakMinutes) {
    const today = new Date().toISOString().slice(0, 10);
    const day = this._ensureDay(today);
    day.completedPomodoros++;
    day.totalFocusMinutes += Math.round(focusMinutes);
    day.totalBreakMinutes += Math.round(breakMinutes);
    this._save();
  }

  recordDistraction() {
    const today = new Date().toISOString().slice(0, 10);
    const day = this._ensureDay(today);
    day.distractions = (day.distractions || 0) + 1;
    this._save();
    return day.distractions;
  }

  recordQuickNote(text, taskId) {
    const today = new Date().toISOString().slice(0, 10);
    const day = this._ensureDay(today);
    if (!day.quickRecords) day.quickRecords = [];
    day.quickRecords.push({ text, time: new Date().toISOString(), taskId: taskId || null });
    this._save();
  }

  getTaskQuickRecords(taskId) {
    const today = new Date().toISOString().slice(0, 10);
    const day = this.data.daily[today];
    if (!day || !day.quickRecords) return [];
    return day.quickRecords.filter(r => r.taskId === taskId);
  }

  getTodayDistractions() {
    const today = new Date().toISOString().slice(0, 10);
    const day = this.data.daily[today];
    return day ? (day.distractions || 0) : 0;
  }

  getTodayStats() {
    const today = new Date().toISOString().slice(0, 10);
    const day = this.data.daily[today];
    return day || { completedPomodoros: 0, totalFocusMinutes: 0, totalBreakMinutes: 0, distractions: 0 };
  }

  getWeekStats() {
    const now = new Date();
    let count = 0;
    let focusMin = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (this.data.daily[key]) {
        count += this.data.daily[key].completedPomodoros;
        focusMin += this.data.daily[key].totalFocusMinutes;
      }
    }
    return { completedPomodoros: count, totalFocusMinutes: focusMin };
  }

  getTotalStats() {
    let count = 0;
    let focusMin = 0;
    for (const day of Object.values(this.data.daily)) {
      count += day.completedPomodoros;
      focusMin += day.totalFocusMinutes;
    }
    return { completedPomodoros: count, totalFocusMinutes: focusMin };
  }
}
