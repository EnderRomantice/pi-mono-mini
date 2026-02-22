# pi-mono-mini

A minimal implementation of the pi-mono architecture - ReAct Loop with Tool Calling.

## Quick Start

### Prerequisites

- Node.js 18+
- API Key from [Kimi Code](https://www.kimi.com/code) or OpenAI

### Installation

```bash
npm install
```

### Configuration

#### Option 1: Kimi Code (Recommended)

```bash
# Set environment variables
export KIMI_CODE_API_KEY=sk-kimi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export KIMI_CODE_BASE_URL=https://api.kimi.com/coding/v1/chat/completions
export KIMI_CODE_MODEL=kimi-for-coding

# Run
npm start
```

Or create a `.env` file:
```bash
KIMI_CODE_API_KEY=sk-kimi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
KIMI_CODE_BASE_URL=https://api.kimi.com/coding/v1/chat/completions
KIMI_CODE_MODEL=kimi-for-coding
```

#### Option 2: OpenAI

```bash
export OPENAI_API_KEY=sk-your-openai-key
npm start
```

## Architecture

```
Phase 1: Core ReAct Loop ✅
  src/
  ├── types.ts          # Core types
  ├── llm.ts            # LLM client (Kimi Code / OpenAI compatible)
  ├── agent.ts          # ReAct Agent
  ├── tools/
  │   └── calculator.ts # Example tool
  └── main.ts           # Entry point

Phase 2: Proactive Agent ✅
  src/proactive/
  ├── index.ts          # ProactiveAgent wrapper
  ├── scheduler.ts      # Task scheduler (cron/at)
  ├── watcher.ts        # File watcher for pending tasks
  └── types.ts          # Task types
  demo-proactive.ts     # Demo script
```

### ReAct Loop

```
User Input → LLM Reasoning → Tool Call? → Execute Tool → (Loop)
                                    ↓
                              No Tool Call
                                    ↓
                           Return Final Answer
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KIMI_CODE_API_KEY` | * | Kimi Code API Key (starts with `sk-kimi-`) |
| `KIMI_CODE_BASE_URL` | | Default: `https://api.kimi.com/coding/v1/chat/completions` |
| `KIMI_CODE_MODEL` | | Default: `kimi-for-coding` |
| `OPENAI_API_KEY` | * | OpenAI API Key |
| `OPENAI_BASE_URL` | | Default: `https://api.openai.com/v1/chat/completions` |
| `OPENAI_MODEL` | | Default: `gpt-4o-mini` |

**Priority**: `KIMI_CODE_API_KEY` > `OPENAI_API_KEY`

## Adding Tools

```typescript
// src/tools/my-tool.ts
import type { Tool } from '../types.js';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'What this tool does',
  parameters: {
    type: 'object',
    properties: {
      arg1: { type: 'string', description: 'Description' }
    },
    required: ['arg1']
  },
  execute: async (args: { arg1: string }) => {
    return 'Result';
  }
};
```

Register in `main.ts`:
```typescript
const agent = new Agent(config, [calculatorTool, myTool]);
```

## Proactive Agent

Proactive Agent 扩展让 Agent 具备了**主动触发**的能力，可以在指定时间自动执行任务，而无需等待用户输入。

### 核心概念

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌─────────────┐
│  Scheduler  │────▶│  Pending │────▶│  Watcher │────▶│   Agent     │
│  (调度器)    │     │ Directory│     │(文件监听)  │     │ (steer())   │
└─────────────┘     └──────────┘     └──────────┘     └─────────────┘
```

- **Scheduler**: 定时检查任务，到期时写入 `pending` 目录
- **PendingWatcher**: 监听文件变化，调用 `agent.steer()` 注入任务
- **Agent**: 像处理普通用户消息一样处理 proactive 任务

### 任务类型

| 类型 | 触发方式 | 示例 |
|------|---------|------|
| `scheduled` | 指定时间触发 | `at: "2025-01-01T00:00:00Z"` |
| `recurring` | Cron 表达式周期触发 | `cron: "*/5 * * * *"` (每5分钟) |
| `event` | 事件触发 | 文件变化、git 提交等 |

### 使用方法

```typescript
import { Agent } from './agent.js';
import { ProactiveAgent } from './proactive/index.js';

// 创建基础 Agent
const agent = new Agent(config, tools);

// 包装为 Proactive Agent
const proactive = new ProactiveAgent(agent, {
  dataDir: '.pi/proactive',  // 任务数据目录
  autoStart: true,           // 自动启动
});

await proactive.init();

// 调度一个 5 秒后触发的任务
await proactive.schedule({
  type: 'scheduled',
  name: 'periodic-check',
  trigger: {
    at: new Date(Date.now() + 5000).toISOString(),
  },
  action: {
    prompt: 'Calculate 2 + 3 and report the result.',
  },
  enabled: true,
});

// 调度周期性任务 (Cron 格式)
await proactive.schedule({
  type: 'recurring',
  name: 'hourly-report',
  trigger: {
    cron: '0 * * * *',  // 每小时执行
  },
  action: {
    prompt: 'Generate a summary of recent activities.',
  },
  enabled: true,
});

// 查看所有任务
const tasks = proactive.listTasks();

// 停止 proactive 系统
proactive.stop();
```

### 运行 Demo

```bash
npm run proactive
```

### 数据存储

Proactive 任务数据默认存储在 `.pi/proactive/` 目录：

```
.pi/proactive/
├── tasks/      # 任务定义 (JSON)
├── pending/    # 待执行的任务
└── results/    # 执行结果记录
```

## Roadmap

- [x] Phase 1: Core ReAct Loop
- [x] Phase 2: Proactive Agent
- [ ] Phase 3: Streaming responses
- [ ] Phase 4: Filesystem and bash tools
- [ ] Phase 5: Interactive TUI

## References

- [Kimi Code API Docs](https://www.kimi.com/code/docs/more/third-party-agents.html)
- [pi-mono](https://github.com/badlogic/pi-mono) - Original implementation
