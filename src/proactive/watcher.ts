/**
 * File Watcher for Proactive Agent
 * 监控 pending 目录，将任务转化为 Agent 的 steer() 消息
 */

import { watch, type FSWatcher } from 'fs';
import { readdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { EventEmitter } from 'events';

export interface PendingTask {
  taskId: string;
  taskName: string;
  prompt: string;
  timestamp: number;
}

export type TaskCallback = (task: PendingTask) => Promise<void>;

export class PendingWatcher extends EventEmitter {
  private pendingDir: string;
  private watcher: FSWatcher | null = null;
  private processing: Set<string> = new Set();
  private onTask: TaskCallback;

  constructor(pendingDir: string, onTask: TaskCallback) {
    super();
    this.pendingDir = pendingDir;
    this.onTask = onTask;
  }

  /**
   * Start watching for pending tasks
   */
  start(): void {
    if (this.watcher) return;

    // Initial scan
    this.scanPending();

    // Watch for new files
    this.watcher = watch(this.pendingDir, (eventType, filename) => {
      if (filename?.endsWith('.json')) {
        // Debounce: wait a bit for file write to complete
        setTimeout(() => this.processFile(filename), 100);
      }
    });

    // Periodic scan (backup)
    setInterval(() => this.scanPending(), 5000);

    console.log('[Watcher] Started watching:', this.pendingDir);
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[Watcher] Stopped');
    }
  }

  /**
   * Scan all pending files
   */
  private async scanPending(): Promise<void> {
    try {
      const files = await readdir(this.pendingDir);
      for (const file of files.filter(f => f.endsWith('.json'))) {
        await this.processFile(file);
      }
    } catch (e) {
      // Directory might not exist yet
    }
  }

  /**
   * Process a single pending file
   */
  private async processFile(filename: string): Promise<void> {
    // Skip if already processing
    if (this.processing.has(filename)) return;
    this.processing.add(filename);

    const filepath = join(this.pendingDir, filename);

    try {
      const content = await readFile(filepath, 'utf-8');
      const task: PendingTask = JSON.parse(content);

      console.log(`[Watcher] Processing task: ${task.taskName}`);
      
      // Notify callback (will call agent.steer())
      await this.onTask(task);

      // Delete after processing
      await unlink(filepath);
      console.log(`[Watcher] Task completed and removed: ${task.taskName}`);
      
      this.emit('processed', task);
    } catch (e: any) {
      console.error(`[Watcher] Failed to process ${filename}:`, e.message);
      this.emit('error', { filename, error: e });
    } finally {
      this.processing.delete(filename);
    }
  }
}
