class TaskManager {
  constructor() {
    this.tasks = [];
  }

  async load() {
    this.tasks = await pomodoroAPI.loadTasks();
  }

  _save() {
    pomodoroAPI.saveTasks(this.tasks);
  }

  setTasks(tasks) {
    this.tasks = tasks;
    this._save();
  }

  toggle(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.completedDate = task.completed ? new Date().toISOString().slice(0, 10) : null;
    this._save();
  }

  remove(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this._save();
  }

  incrementPomodoro(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.completedPomodoros < task.totalPomodoros) {
      task.completedPomodoros++;
    }
    this._save();
  }

  get activeCount() {
    return this.tasks.filter(t => !t.completed).length;
  }
}
