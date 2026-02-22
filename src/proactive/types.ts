/**
 * Proactive Agent Types
 * 任务调度系统类型定义
 */

export type TaskType = 'scheduled' | 'recurring' | 'event';

export interface Task {
  id: string;
  type: TaskType;
  name: string;
  
  // 触发条件
  trigger: {
    // 定时触发: cron 表达式或 ISO 时间
    at?: string;           // ISO 8601 timestamp
    cron?: string;         // Cron expression (for recurring)
    // 事件触发: 文件变化等
    event?: 'file-change' | 'git-commit' | 'http';
    eventData?: any;
  };
  
  // 执行内容
  action: {
    // 发给 Agent 的提示词（像用户输入一样）
    prompt: string;
    // 可选：特定的工具限制
    allowedTools?: string[];
  };
  
  // 状态
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  maxRuns?: number;
  
  // 元数据
  createdAt: number;
  description?: string;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  timestamp: number;
}

export type TaskHandler = (task: Task) => Promise<void>;
