class Timer {
  constructor() {
    this.settings = this._loadSettings();
    this.state = 'idle'; // idle | running | paused | done
    this.sessionType = 'focus'; // focus | break | longBreak
    this.sessionIndex = 0;
    this.remainingSeconds = this.settings.focusMinutes * 60;
    this.totalSeconds = this.remainingSeconds;
    this.intervalId = null;
    this.onDone = null;
    this.onTick = null;
    this.onSessionChange = null;
  }

  // --- Settings ---
  _loadSettings() {
    try {
      const raw = localStorage.getItem('pomodoro-settings');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, longBreakInterval: 4 };
  }

  saveSettings(focusMinutes, breakMinutes, longBreakMinutes, longBreakInterval) {
    this.settings = { focusMinutes, breakMinutes, longBreakMinutes, longBreakInterval };
    localStorage.setItem('pomodoro-settings', JSON.stringify(this.settings));
    if (this.state === 'idle') {
      this.sessionType = 'focus';
      this.sessionIndex = 0;
      this._setDuration(this.settings.focusMinutes);
      if (this.onSessionChange) this.onSessionChange();
      if (this.onTick) this.onTick();
    }
  }

  // --- Session cycling ---
  _sessionSequence() {
    const n = this.settings.longBreakInterval;
    const seq = [];
    for (let i = 0; i < n; i++) {
      seq.push('focus');
      if (i < n - 1) seq.push('break');
    }
    seq.push('longBreak');
    return seq;
  }

  _setDuration(minutes) {
    this.remainingSeconds = minutes * 60;
    this.totalSeconds = this.remainingSeconds;
  }

  _advanceSession() {
    const seq = this._sessionSequence();
    this.sessionIndex = (this.sessionIndex + 1) % seq.length;
    this.sessionType = seq[this.sessionIndex];

    switch (this.sessionType) {
      case 'focus':
        this._setDuration(this.settings.focusMinutes);
        break;
      case 'break':
        this._setDuration(this.settings.breakMinutes);
        break;
      case 'longBreak':
        this._setDuration(this.settings.longBreakMinutes);
        break;
    }

    if (this.onSessionChange) this.onSessionChange();
  }

  _sessionLabel() {
    const seq = this._sessionSequence();
    let focusCount = 0;
    for (let i = 0; i <= this.sessionIndex; i++) {
      if (seq[i] === 'focus') focusCount++;
    }
    return `Session ${focusCount} / ${this.settings.longBreakInterval}`;
  }

  // --- Controls ---
  start() {
    if (this.state === 'running') return;
    if (this.state === 'done') {
      this._advanceSession();
    }
    this.state = 'running';
    this._tick();
    this.intervalId = setInterval(() => this._tick(), 1000);
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this._tick();
    this.intervalId = setInterval(() => this._tick(), 1000);
  }

  reset() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.state = 'idle';
    this.sessionType = 'focus';
    this.sessionIndex = 0;
    this._setDuration(this.settings.focusMinutes);
    if (this.onTick) this.onTick();
    if (this.onSessionChange) this.onSessionChange();
  }

  skip() {
    const wasRunning = this.state === 'running';
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.state = 'idle';
    this._advanceSession();
    if (wasRunning) {
      this.start();
    } else {
      if (this.onTick) this.onTick();
    }
  }

  // --- Tick ---
  _tick() {
    if (this.remainingSeconds <= 0) {
      this.state = 'done';
      clearInterval(this.intervalId);
      this.intervalId = null;
      if (this.onDone) this.onDone(this.sessionType, this.totalSeconds / 60);
      return;
    }
    if (this.state === 'running') {
      this.remainingSeconds--;
    }
    if (this.onTick) this.onTick();
  }

  // --- Getters ---
  get minutes() {
    return Math.floor(this.remainingSeconds / 60);
  }

  get seconds() {
    return this.remainingSeconds % 60;
  }

  get percentRemaining() {
    return this.remainingSeconds / this.totalSeconds;
  }

  get sessionDisplay() {
    return this._sessionLabel();
  }
}
