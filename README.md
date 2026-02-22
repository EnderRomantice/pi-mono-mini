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
Phase 1: Core ✅
  src/core/
  ├── types.ts          # Core types
  ├── llm.ts            # LLM client (OpenAI-compatible)
  ├── agent.ts          # ReAct Agent
  └── index.ts          # Core exports

Phase 2: Chat Interface ✅
  src/chat/
  ├── cli.ts            # Interactive CLI
  ├── session.ts        # Chat session management
  └── index.ts          # Chat exports

Phase 3: Proactive Agent ✅
  src/proactive/
  ├── index.ts          # ProactiveAgent wrapper
  ├── scheduler.ts      # Task scheduler (cron/at)
  ├── watcher.ts        # File watcher for pending tasks
  └── types.ts          # Task types
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

## Usage

### Interactive Chat

```bash
npm start
```

Commands available in chat:
- `/help` - Show available commands
- `/clear` - Clear conversation history
- `/history` - Show conversation history
- `/export` - Export conversation as markdown
- `/quit` - Exit the chat

### Using as a Library

```typescript
import { Agent, getLLMConfigFromEnv } from './core/index.js';

const llmConfig = getLLMConfigFromEnv();
const agent = new Agent({
  systemPrompt: 'You are a helpful assistant.',
  llm: llmConfig,
}, []);

const response = await agent.run('Hello!');
console.log(response);
```

## Proactive Agent

The Proactive Agent extension enables the Agent with **proactive triggering** capabilities, allowing tasks to be executed automatically at specified times without waiting for user input.

### Core Concepts

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌─────────────┐
│  Scheduler  │────▶│  Pending │────▶│  Watcher │────▶│   Agent     │
│  (scheduler)│     │ Directory│     │(file watch)│    │ (steer())   │
└─────────────┘     └──────────┘     └──────────┘     └─────────────┘
```

- **Scheduler**: Periodically checks tasks and writes to the `pending` directory when due
- **PendingWatcher**: Listens for file changes and injects tasks via `agent.steer()`
- **Agent**: Handles proactive tasks just like regular user messages

### Task Types

| Type | Trigger | Example |
|------|---------|---------|
| `scheduled` | Trigger at specified time | `at: "2025-01-01T00:00:00Z"` |
| `recurring` | Cron expression (periodic) | `cron: "*/5 * * * *"` (every 5 minutes) |
| `event` | Event-driven | File changes, git commits, etc. |

### Usage

```typescript
import { Agent } from './agent.js';
import { ProactiveAgent } from './proactive/index.js';

// Create base Agent
const agent = new Agent(config, tools);

// Wrap with Proactive capabilities
const proactive = new ProactiveAgent(agent, {
  dataDir: '.pi/proactive',  // Task data directory
  autoStart: true,           // Auto-start
});

await proactive.init();

// Schedule a task to trigger in 5 seconds
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

// Schedule a recurring task (Cron format)
await proactive.schedule({
  type: 'recurring',
  name: 'hourly-report',
  trigger: {
    cron: '0 * * * *',  // Run every hour
  },
  action: {
    prompt: 'Generate a summary of recent activities.',
  },
  enabled: true,
});

// List all tasks
const tasks = proactive.listTasks();

// Stop the proactive system
proactive.stop();
```

### Run Demo

```bash
npm run proactive
```

### Data Storage

Proactive task data is stored by default in the `.pi/proactive/` directory:

```
.pi/proactive/
├── tasks/      # Task definitions (JSON)
├── pending/    # Pending tasks to be executed
└── results/    # Execution result logs
```

## Roadmap

- [x] Phase 1: Core (ReAct Agent + Tool Calling)
- [x] Phase 2: Chat Interface (Interactive CLI)
- [x] Phase 3: Proactive Agent (Scheduled tasks)
- [ ] Phase 4: Streaming responses
- [ ] Phase 5: Filesystem and bash tools

## Examples

### Smart Assistant (Chat + Proactive)

A smart assistant that combines interactive chat with proactive reminders:

```bash
npm run example:assistant
```

**Features:**
- Normal conversations
- Set reminders from natural language: `remind me in 10 seconds to drink water`
- Proactive notifications when time is up

See [`examples/assistant/`](examples/assistant/) for implementation details.

## References

- [Kimi Code API Docs](https://www.kimi.com/code/docs/more/third-party-agents.html)
- [pi-mono](https://github.com/badlogic/pi-mono) - Original implementation
