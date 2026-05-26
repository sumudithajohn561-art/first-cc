# Pomodoro Timer

A desktop Pomodoro Timer with task management and statistics, built with Electron.

## Features

- 25-minute focus sessions with 5-minute short breaks and 15-minute long breaks
- Desktop notifications when sessions end
- Task list with add, complete, and delete
- Daily, weekly, and all-time statistics
- Configurable durations and long break interval
- Keyboard shortcuts (Space to start/pause, R to reset, S to skip)

## Setup

```bash
npm install
npm start
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Start / Pause / Resume |
| R | Reset timer |
| S | Skip current session |

## Data

All data is stored locally in `%APPDATA%/pomodoro-app/data/`:
- `tasks.json` — your task list
- `stats.json` — your completed pomodoro history
