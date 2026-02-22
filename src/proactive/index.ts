/**
 * Proactive Agent Extension
 */

import { Agent } from '../core/agent.js';
import { Scheduler } from './scheduler.js';
import { PendingWatcher, type PendingTask } from './watcher.js';
import type { Task } from './types.js';
import { join } from 'path';

export interface ProactiveConfig {
  // 数据目录
  dataDir?: string;
  // 是否自动启动 scheduler
  autoStart?: boolean;
}

/**
 * ProactiveAgent 包装器
 * 为普通 Agent 添加 proactive 能力
 */
export class ProactiveAgent {
  public agent: Agent;
  public scheduler: Scheduler;
  public watcher: PendingWatcher;
  
  private config: Required<ProactiveConfig>;
  private isRunning: boolean = false;

  constructor(agent: Agent, config: ProactiveConfig = {}) {
    this.agent = agent;
    this.config = {
      dataDir: '.pi/proactive',
      autoStart: true,
      ...config,
    };

    // Create scheduler
    this.scheduler = new Scheduler(this.config.dataDir);

    // Create watcher - converts pending tasks to steer() messages
    const pendingDir = join(this.config.dataDir, 'pending');
    this.watcher = new PendingWatcher(pendingDir, this.handlePendingTask.bind(this));
  }

  /**
   * Initialize proactive system
   */
  async init(): Promise<void> {
    await this.scheduler.init();
    
    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start watching for proactive tasks
   */
  start(): void {
    if (this.isRunning) return;
    
    this.watcher.start();
    this.isRunning = true;
    console.log('[Proactive] System started');
  }

  /**
   * Stop proactive system
   */
  stop(): void {
    this.watcher.stop();
    this.scheduler.stop();
    this.isRunning = false;
    console.log('[Proactive] System stopped');
  }

  /**
   * Schedule a new task
   */
  async schedule(task: Omit<Task, 'id' | 'createdAt' | 'runCount'>): Promise<Task> {
    return this.scheduler.createTask(task);
  }

  /**
   * Handle pending task from watcher
   * This is the core integration point - uses agent.steer()
   */
  private async handlePendingTask(task: PendingTask): Promise<void> {
    console.log(`[Proactive] Injecting task: ${task.taskName}`);

    // Create a "virtual user message" that looks like it came from user
    const proactiveMessage = {
      role: 'user' as const,
      content: `[Proactive Task: ${task.taskName}]\n${task.prompt}`,
      timestamp: Date.now(),
    };

    // Use steer() to inject the message
    // If agent is idle, trigger immediately
    // If agent is busy, it will be processed after current work
    (this.agent as any).steer?.(proactiveMessage);

    // If agent is not currently streaming, trigger it
    const agentState = (this.agent as any).state;
    if (!agentState?.isStreaming) {
      console.log('[Proactive] Agent is idle, triggering...');
      await (this.agent as any).continue?.();
    } else {
      console.log('[Proactive] Agent is busy, queued for later');
    }

    // Record result (success/failure handled by agent events)
    await this.scheduler.recordResult({
      taskId: task.taskId,
      success: true,
      timestamp: Date.now(),
    });
  }

  /**
   * List all scheduled tasks
   */
  listTasks(): Task[] {
    return this.scheduler.listTasks();
  }
}

// Re-export types
export * from './types.js';
export { Scheduler, PendingWatcher };
