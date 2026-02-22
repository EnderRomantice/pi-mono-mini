/**
 * Task Scheduler for Proactive Agent
 * 管理定时任务，支持 cron 和一次性任务
 */

import type { Task, TaskType, TaskResult } from './types.js';
import { mkdir, writeFile, readFile, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';

// Simple cron parser (for demo, use node-cron in production)
function parseCron(cron: string, now: Date): Date | null {
  // 简化实现：只支持简单的分钟级调度
  // 格式: "*/5 * * * *" (每5分钟)
  const parts = cron.split(' ');
  if (parts[0]?.startsWith('*/')) {
    const interval = parseInt(parts[0].slice(2));
    const next = new Date(now);
    const currentMin = now.getMinutes();
    const nextMin = Math.ceil((currentMin + 1) / interval) * interval;
    next.setMinutes(nextMin);
    next.setSeconds(0);
    next.setMilliseconds(0);
    return next;
  }
  return null;
}

export class Scheduler extends EventEmitter {
  private tasksDir: string;
  private pendingDir: string;
  private resultsDir: string;
  private tasks: Map<string, Task> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  
  constructor(baseDir: string = '.pi/proactive') {
    super();
    this.tasksDir = join(baseDir, 'tasks');
    this.pendingDir = join(baseDir, 'pending');
    this.resultsDir = join(baseDir, 'results');
  }

  /**
   * Initialize directories and load tasks
   */
  async init(): Promise<void> {
    await mkdir(this.tasksDir, { recursive: true });
    await mkdir(this.pendingDir, { recursive: true });
    await mkdir(this.resultsDir, { recursive: true });
    
    await this.loadTasks();
    this.start();
  }

  /**
   * Create a new task
   */
  async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'runCount'>): Promise<Task> {
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      runCount: 0,
      ...taskData,
    };

    // Calculate next run time
    if (task.trigger.at) {
      task.nextRun = new Date(task.trigger.at).getTime();
    } else if (task.trigger.cron) {
      const next = parseCron(task.trigger.cron, new Date());
      if (next) task.nextRun = next.getTime();
    }

    this.tasks.set(task.id, task);
    await this.saveTask(task);
    
    console.log(`[Scheduler] Task created: ${task.name} (${task.id})`);
    return task;
  }

  /**
   * List all tasks
   */
  listTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a specific task
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    this.tasks.delete(id);
    const filePath = join(this.tasksDir, `${id}.json`);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  /**
   * Enable/disable a task
   */
  async toggleTask(id: string, enabled: boolean): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.enabled = enabled;
      await this.saveTask(task);
    }
  }

  /**
   * Start the scheduler loop
   */
  start(): void {
    if (this.checkInterval) return;
    
    // Check every 10 seconds for due tasks
    this.checkInterval = setInterval(() => this.checkTasks(), 10000);
    console.log('[Scheduler] Started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[Scheduler] Stopped');
    }
  }

  /**
   * Check for due tasks and trigger them
   */
  private async checkTasks(): Promise<void> {
    const now = Date.now();
    
    for (const task of this.tasks.values()) {
      if (!task.enabled) continue;
      if (!task.nextRun || task.nextRun > now) continue;
      if (task.maxRuns && task.runCount >= task.maxRuns) continue;

      // Trigger the task
      await this.triggerTask(task);
    }
  }

  /**
   * Trigger a task - write to pending directory
   */
  private async triggerTask(task: Task): Promise<void> {
    console.log(`[Scheduler] Triggering task: ${task.name}`);
    
    task.lastRun = Date.now();
    task.runCount++;
    
    // Calculate next run for recurring tasks
    if (task.type === 'recurring' && task.trigger.cron) {
      const next = parseCron(task.trigger.cron, new Date());
      if (next) task.nextRun = next.getTime();
    } else {
      // One-time task done - keep as is or set to a far future
      task.nextRun = undefined as any; // One-time task done
    }
    
    await this.saveTask(task);

    // Write to pending directory (file watcher will pick this up)
    const pendingFile = join(this.pendingDir, `${task.id}-${Date.now()}.json`);
    await writeFile(pendingFile, JSON.stringify({
      taskId: task.id,
      taskName: task.name,
      prompt: task.action.prompt,
      timestamp: Date.now(),
    }, null, 2));

    this.emit('trigger', task);
  }

  /**
   * Load tasks from disk
   */
  private async loadTasks(): Promise<void> {
    const files = await readdir(this.tasksDir).catch(() => []);
    
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await readFile(join(this.tasksDir, file), 'utf-8');
        const task = JSON.parse(content) as Task;
        this.tasks.set(task.id, task);
      } catch (e) {
        console.error(`[Scheduler] Failed to load task ${file}:`, e);
      }
    }
    
    console.log(`[Scheduler] Loaded ${this.tasks.size} tasks`);
  }

  /**
   * Save task to disk
   */
  private async saveTask(task: Task): Promise<void> {
    const filePath = join(this.tasksDir, `${task.id}.json`);
    await writeFile(filePath, JSON.stringify(task, null, 2));
  }

  /**
   * Record task result
   */
  async recordResult(result: TaskResult): Promise<void> {
    const filePath = join(this.resultsDir, `${result.taskId}-${result.timestamp}.json`);
    await writeFile(filePath, JSON.stringify(result, null, 2));
  }
}
