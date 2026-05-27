class MarkdownSync {
  constructor(taskManager, vaultPath, dailyPath) {
    this.taskManager = taskManager;
    this.vaultPath = vaultPath;
    this.dailyPath = dailyPath || '经验总结/日报';
    this._fileChangeDebounce = null;
    this._suppressWatch = false;
    this.onTasksChanged = null;
  }

  // ====================================================================
  //  PARSER: Obsidian markdown → Task array (READ-ONLY)
  // ====================================================================

  parseMarkdown(md) {
    const tasks = [];
    const lines = md.split('\n');
    let currentSection = null;
    let currentParent = null; // parent task for sub-tasks

    for (const line of lines) {
      const workMatch = line.match(/^##\s*工作任务/);
      const studyMatch = line.match(/^##\s*学习任务/);
      if (workMatch) { currentSection = 'work'; currentParent = null; continue; }
      if (studyMatch) { currentSection = 'study'; currentParent = null; continue; }
      if (/^##\s/.test(line)) { currentSection = null; currentParent = null; continue; }

      const taskMatch = line.match(/^(\s*)-\s+\[([ x])\]\s+(.+)/);
      if (!taskMatch) continue;

      const indent = taskMatch[1];
      const isSubtask = indent.length >= 4;
      const completed = taskMatch[2] === 'x';
      const content = taskMatch[3].trim();

      const task = this._parseTaskContent(content, completed);

      if (task) {
        task.taskType = currentSection === 'study' ? 'study' : 'work';

        // Prevent ID collision: if a previously parsed task already has this ID, generate a new one
        if (tasks.some(t => t.id === task.id)) {
          task.id = this._generateId();
        }

        if (isSubtask && currentParent) {
          // Sub-task: combine with parent name
          task.text = `${currentParent.text} (${task.text})`;
          task.timeSlot = task.timeSlot || currentParent.timeSlot;
          task.scheduledDate = task.scheduledDate || currentParent.scheduledDate;
          task.priority = task.priority !== 'none' ? task.priority : currentParent.priority;
          task.priorityEmoji = task.priorityEmoji || currentParent.priorityEmoji;
          task.isSubtask = true;
          task.parentId = currentParent.id;
        } else if (!isSubtask) {
          // Main task: set as current parent for subsequent sub-tasks
          currentParent = task;
          task.isSubtask = false;
          task.parentId = null;
        }

        // Preserve existing pomodoro data (don't override auto-calculated values with 0)
        const existing = this.taskManager.tasks.find(t => t.id === task.id);
        if (existing) {
          task.createdAt = existing.createdAt;
          // Detect if task was rescheduled (time slot or date changed)
          const rescheduled =
            task.timeSlot !== existing.timeSlot ||
            task.scheduledDate !== existing.scheduledDate;

          task.completedPomodoros = rescheduled ? 0 : (existing.completedPomodoros || 0);
          task.totalPomodoros = rescheduled ? task.totalPomodoros : (existing.totalPomodoros || task.totalPomodoros);
          task.estimatedMinutes = rescheduled ? task.estimatedMinutes : (existing.estimatedMinutes || task.estimatedMinutes);

          // If rescheduled, clear completion state
          if (rescheduled && existing.completed && !completed) {
            task.completed = false;
            task.completedAt = null;
            task.completedDate = null;
          } else if (!completed && existing.completed) {
            // Only preserve local completion if markdown still has ✅ date;
            // if user removed both [x] and ✅, they intentionally unchecked in Obsidian
            if (task.completedDate) {
              task.completed = true;
              task.completedAt = existing.completedAt;
              task.completedDate = existing.completedDate;
            }
            // else: markdown is authoritative — keep completed=false
          }
        }

        tasks.push(task);
      }
    }
    return tasks;
  }

  _parseTaskContent(content, completed) {
    let text = content;
    let timeSlot = '';
    let scheduledDate = new Date().toISOString().slice(0, 10);
    let priority = 'none';
    let priorityEmoji = '';
    let completedDate = null;

    // Extract completedDate: ✅ YYYY-MM-DD
    const doneMatch = text.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
    if (doneMatch) {
      completedDate = doneMatch[1];
      text = text.replace(/✅\s*\d{4}-\d{2}-\d{2}/, '').trim();
    }

    // Extract scheduledDate: ⏳ YYYY-MM-DD
    const dateMatch = text.match(/⏳\s*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      scheduledDate = dateMatch[1];
      text = text.replace(/⏳\s*\d{4}-\d{2}-\d{2}/, '').trim();
    }

    // Extract timeSlot: HH:MM-HH:MM (normalize to zero-padded hours)
    const timeMatch = text.match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      timeSlot = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}-${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}`;
      text = text.replace(/^\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}/, '').trim();
    }

    // Extract priority emoji
    if (/🔺/.test(text)) { priority = 'high'; priorityEmoji = '🔺'; text = text.replace(/🔺\s*/, '').trim(); }
    else if (/🔸/.test(text)) { priority = 'medium'; priorityEmoji = '🔸'; text = text.replace(/🔸\s*/, '').trim(); }
    else if (/🔽/.test(text)) { priority = 'low'; priorityEmoji = '🔽'; text = text.replace(/🔽\s*/, '').trim(); }

    // Estimated minutes (explicit)
    let estimatedMinutes = 0;
    const estMatch = text.match(/(\d+)\s*(min|分钟|m)\s*$/i);
    if (estMatch) {
      estimatedMinutes = parseInt(estMatch[1]);
      text = text.replace(/\d+\s*(min|分钟|m)\s*$/i, '').trim();
    }

    // Derive estimatedMinutes from timeSlot if not explicitly set
    if (estimatedMinutes === 0 && timeSlot) {
      const tsMatch = timeSlot.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
      if (tsMatch) {
        const startMin = parseInt(tsMatch[1]) * 60 + parseInt(tsMatch[2]);
        const endMin = parseInt(tsMatch[3]) * 60 + parseInt(tsMatch[4]);
        const duration = endMin - startMin;
        if (duration > 0) estimatedMinutes = duration;
      }
    }

    // Calculate total pomodoros (25 min each)
    const FOCUS_MIN = 25;
    const autoPomos = estimatedMinutes > 0 ? Math.ceil(estimatedMinutes / FOCUS_MIN) : 0;

    // Match existing task by text+scheduledDate+timeSlot (timeSlot prevents ID collision for same-name tasks)
    const existing = this.taskManager.tasks.find(
      t => t.scheduledDate === scheduledDate && t.text === text && t.timeSlot === timeSlot
    );

    return {
      id: existing ? existing.id : this._generateId(),
      text: text || content,
      timeSlot,
      scheduledDate,
      priority,
      priorityEmoji,
      completed,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      completedAt: completed ? (existing ? existing.completedAt : new Date().toISOString()) : null,
      completedDate: completed ? (completedDate || new Date().toISOString().slice(0, 10)) : null,
      estimatedMinutes: existing ? (existing.estimatedMinutes || estimatedMinutes) : estimatedMinutes,
      completedPomodoros: existing ? existing.completedPomodoros : 0,
      totalPomodoros: existing ? (existing.totalPomodoros || autoPomos) : autoPomos,
      isSubtask: false,
      parentId: null,
    };
  }

  // ====================================================================
  //  FILE I/O
  // ====================================================================

  async readFromVault(dateStr) {
    if (!this.vaultPath) return false;
    const md = await pomodoroAPI.readReportFile(this.vaultPath, this.dailyPath, dateStr);
    if (!md || md.trim() === '') return false;
    const parsed = this.parseMarkdown(md);

    // Obsidian checkbox state is authoritative — update local state to match
    for (const pTask of parsed) {
      const local = this.taskManager.tasks.find(t => t.id === pTask.id);
      if (local) {
        if (!pTask.completed && local.completed) {
          // User unchecked in Obsidian — revert local completion
          local.completed = false;
          local.completedAt = null;
          local.completedDate = null;
          local.summary = null;
          this.taskManager._save();
        }
      }
    }

    this.taskManager.setTasks(parsed);
    return true;
  }

  // Toggle a single task's checkbox in the Obsidian markdown file
  async writeTaskCheckbox(dateStr, task, completed) {
    if (!this.vaultPath) return false;
    const md = await pomodoroAPI.readReportFile(this.vaultPath, this.dailyPath, dateStr);
    if (!md) return false;

    const lines = md.split('\n');
    const searchParts = [];
    if (task.timeSlot) {
      // Build regex that matches both padded (09:00) and non-padded (9:00) hours
      const m = task.timeSlot.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
      if (m) {
        searchParts.push(`0?${parseInt(m[1])}:${m[2]}[-–—]0?${parseInt(m[3])}:${m[4]}`);
      } else {
        searchParts.push(task.timeSlot.replace('-', '[-–—]'));
      }
    }
    if (task.scheduledDate) searchParts.push(task.scheduledDate);
    if (task.priorityEmoji) searchParts.push(task.priorityEmoji);
    const escapedText = task.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    searchParts.push(escapedText);

    const fromMark = completed ? '[ ]' : '[x]';
    const toMark = completed ? '[x]' : '[ ]';
    const addDone = completed ? ` ✅ ${new Date().toISOString().slice(0, 10)}` : '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const taskMatch = line.match(/^(\s*)-\s+\[([ x])\]\s+(.+)/);
      if (!taskMatch) continue;

      const indent = taskMatch[1];
      const content = taskMatch[3];

      // Check if this line contains all identifying parts of our task
      let matches = true;
      for (const part of searchParts) {
        if (!content.includes(part.replace('[-–—]', '-')) && !new RegExp(part).test(content)) {
          // Try matching the original patterns
          matches = false;
          break;
        }
      }
      // More precise match: verify by parsing this line and comparing text
      if (matches) {
        const parsed = this._parseTaskContent(content, taskMatch[2] === 'x');
        if (parsed.text === task.text) {
          let newContent = content;
          // Remove existing ✅ date if toggling to completed
          if (completed && !/✅/.test(newContent)) {
            newContent += addDone;
          } else if (!completed) {
            newContent = newContent.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
          }
          lines[i] = `${indent}- ${toMark} ${newContent}`;
          break;
        }
      }
    }

    this._suppressWatch = true;
    const updated = lines.join('\n');
    if (updated === md) { this._suppressWatch = false; return false; }
    const result = await pomodoroAPI.writeReportFile(this.vaultPath, this.dailyPath, dateStr, updated);
    // Re-enable watcher after a short delay (allow FS event to pass)
    setTimeout(() => { this._suppressWatch = false; }, 500);
    return result;
  }

  // ====================================================================
  //  DEBOUNCE & WATCH
  // ====================================================================

  async onExternalChange(dateStr) {
    if (this._suppressWatch) return;
    clearTimeout(this._fileChangeDebounce);
    this._fileChangeDebounce = setTimeout(async () => {
      await this.readFromVault(dateStr);
      if (this.onTasksChanged) this.onTasksChanged();
    }, 300);
  }

  async startWatching(dateStr) {
    if (this.vaultPath) {
      await pomodoroAPI.watchReportFile(this.vaultPath, this.dailyPath, dateStr);
    }
  }

  async switchDate(newDateStr) {
    await this.startWatching(newDateStr);
    await this.readFromVault(newDateStr);
    if (this.onTasksChanged) this.onTasksChanged();
  }

  // ====================================================================
  //  TASK SUMMARY SYNC
  // ====================================================================

  async writeTaskSummary(dateStr, task) {
    if (!this.vaultPath) return false;
    const md = await pomodoroAPI.readReportFile(this.vaultPath, this.dailyPath, dateStr);
    if (!md) return false;

    const lines = md.split('\n');
    const summary = task.summary;
    let entries;

    if (task.text.includes('项目') && summary && typeof summary === 'object') {
      entries = [
        `- ${task.text}：`,
        `    - 工作进展：${summary.progress || ''}`,
        `    - 问题与风险：${summary.issues || ''}`,
        `    - 后续行动计划：${summary.nextSteps || ''}`,
        `    - 需协调资源事项：${summary.resources || ''}`,
      ];
    } else {
      const text = typeof summary === 'string' ? summary : (summary && summary.progress) || '';
      entries = [`- ${task.text}：${text}`];
    }

    // Project tasks ("项目") → （1）工作总结, all others → （2）学习总结
    const pattern = task.text.includes('项目')
      ? /^##\s*（1）\s*工作总结/
      : /^##\s*（2）\s*学习总结/;

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i].trim())) {
        lines.splice(i + 1, 0, ...entries);
        break;
      }
    }

    const updated = lines.join('\n');
    return await pomodoroAPI.writeReportFile(this.vaultPath, this.dailyPath, dateStr, updated);
  }

  // ====================================================================
  //  FRONTMATTER SYNC (write focus_hours / efficiency only)
  // ====================================================================

  async syncFrontmatter(dateStr, focusHours, starRating) {
    if (!this.vaultPath) return false;
    const md = await pomodoroAPI.readReportFile(this.vaultPath, this.dailyPath, dateStr);
    if (!md) return false;

    const updated = this._updateFrontmatter(md, focusHours, starRating);
    if (updated === md) return false; // no change
    return await pomodoroAPI.writeReportFile(this.vaultPath, this.dailyPath, dateStr, updated);
  }

  _updateFrontmatter(md, focusHours, starRating) {
    const fmMatch = md.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) return md;

    const fmBlock = fmMatch[0];
    const fmContent = fmMatch[1];
    const beforeFm = md.slice(0, fmMatch.index);
    const afterFm = md.slice(fmMatch.index + fmBlock.length);

    let updated = fmContent;

    const hoursRounded = Math.round(focusHours * 10) / 10;

    if (/^focus_hours\s*:/m.test(updated)) {
      updated = updated.replace(/^focus_hours\s*:.*/m, `focus_hours: ${hoursRounded}`);
    } else {
      updated += `\nfocus_hours: ${hoursRounded}`;
    }

    if (/^efficiency\s*:/m.test(updated)) {
      updated = updated.replace(/^efficiency\s*:.*/m, `efficiency: "${starRating}"`);
    } else {
      updated += `\nefficiency: "${starRating}"`;
    }

    return `${beforeFm}---\n${updated}\n---${afterFm}`;
  }

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}
