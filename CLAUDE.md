# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A desktop Pomodoro Timer built with Electron. Manages focus/break sessions with task tracking sourced from Obsidian daily markdown reports. The app reads tasks from Obsidian vault files, tracks pomodoros against them, and writes completion summaries back.

## Commands

```bash
npm install          # Install dependencies (electron)
npm start            # Launch the Electron app
```

No test suite, linter, or build tooling exists.

## Architecture

**Three-process Electron app** with context isolation:

- **`main.js`** — Main process. All file I/O (tasks.json, stats.json, settings.json in `%APPDATA%/pomodoro-app/data/`), desktop notifications, IPC handlers for settings and Obsidian report read/write. Polls the daily report file every 2s for changes from Obsidian. Monitors whether `Obsidian.exe` is running via tasklist and quits the app when it closes.
- **`preload.js`** — Bridge. Exposes `pomodoroAPI` on `window` via `contextBridge`. Every renderer→main call goes through this API.
- **`src/renderer/`** — Renderer (single-page, no framework):
  - `index.html` — Complete UI: timer ring, task table, stats bar, and four overlay modals (quick record, settings, task completion, task review).
  - `app.js` — Bootstrap/controller. Wires DOM refs, timer callbacks, keyboard shortcuts (Space/R/S), settings UI, task selection, overlay management, idle/task reminders, and the init sequence.
  - `timer.js` — `Timer` class. State machine: `idle → running → paused → done`. Cycles through focus→break→longBreak via a session sequence. Settings persisted in `localStorage`.
  - `tasks.js` — `TaskManager` class. Thin model persisted via `pomodoroAPI.saveTasks/loadTasks` → main process JSON files.
  - `stats.js` — `StatsTracker` class. Daily/weekly/total pomodoro counts, distractions, quick records. Persisted via `pomodoroAPI.saveStats/loadStats`.
  - `sync.js` — `MarkdownSync` class. Parses Obsidian daily markdown into task objects (extracting time slots, priorities, checkboxes, scheduled dates). Writes completions, summaries, and frontmatter (`focus_hours`, `efficiency`) back to the markdown file. Handles external file change debouncing with a 300ms delay and suppresses self-triggered watch events.

## Key data flows

1. **Tasks originate from Obsidian.** User writes `- [ ] HH:MM-HH:MM Task text` under `## 工作任务` or `## 学习任务` sections in a daily report file. `MarkdownSync.parseMarkdown()` extracts them. The "Sync from Obsidian" button or app init triggers `readFromVault()`.
2. **Task types drive completion UX.** Tasks containing `项目` are "work" tasks and get a 4-field structured completion form (progress, issues, next steps, resources). Everything else is "study" with a single summary field.
3. **Timer completion** records a pomodoro on the active task, shows a quick-record overlay for session notes, and syncs frontmatter (`focus_hours`, `efficiency` star rating) back to the Obsidian file.
4. **Obsidian checkbox state is authoritative.** If a task is unchecked in Obsidian, local completion state is reverted on next sync. The markdown file is the source of truth.
5. **Daily rollover** happens via a 60s interval that detects date changes and re-syncs from the new day's Obsidian report.

## Settings keys (IPC + settings.json)

- `vaultPath` — Absolute path to Obsidian vault
- `dailyPath` — Relative path within vault for daily reports (default: `经验总结/日报`)
- `dailyGoal` — Daily pomodoro target (default: 12)
- `reminderTime` — HH:MM for daily summary reminder
- `taskReminderMinutes` — Minutes before task deadline to fire a warning (default: 5)
