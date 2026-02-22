/**
 * File Watcher for Proactive Agent
 */

import { watch, type FSWatcher, existsSync } from 'fs';
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
  private processed: Set<string> = new Set(); // Track completed tasks
  private onTask: TaskCallback;

  constructor(pendingDir: string, onTask: TaskCallback) {
    super();
    this.pendingDir = pendingDir;
    this.onTask = onTask;
    
    // Prevent unhandled error crashes
    this.on('error', () => {});
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
    // Skip if already processed (prevent race conditions)
    if (this.processing.has(filename) || this.processed.has(filename)) {
      return;
    }
    
    const filepath = join(this.pendingDir, filename);
    
    // Check file exists (might have been processed by another watcher/scan)
    if (!existsSync(filepath)) {
      return;
    }
    
    this.processing.add(filename);

    try {
      const content = await readFile(filepath, 'utf-8');
      const task: PendingTask = JSON.parse(content);

      console.log(`[Watcher] Processing task: ${task.taskName}`);
      
      // Notify callback (will call agent.steer())
      await this.onTask(task);

      // Mark as processed before deletion
      this.processed.add(filename);
      
      // Delete after processing
      try {
        await unlink(filepath);
        console.log(`[Watcher] Task completed and removed: ${task.taskName}`);
      } catch (e: any) {
        // File might already be deleted (race condition), that's ok
        if (e.code !== 'ENOENT') {
          throw e;
        }
      }
      
      this.emit('processed', task);
    } catch (e: any) {
      // Silently ignore ENOENT (file already processed by another instance)
      if (e.code === 'ENOENT') {
        this.processed.add(filename); // Mark as done to prevent retry
      } else {
        console.error(`[Watcher] Failed to process ${filename}:`, e.message);
        this.emit('error', { filename, error: e });
      }
    } finally {
      this.processing.delete(filename);
    }
  }
}
