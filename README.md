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

## Roadmap

- [x] Phase 1: Core ReAct Loop
- [ ] Phase 2: Streaming responses
- [ ] Phase 3: Filesystem and bash tools
- [ ] Phase 4: Interactive TUI

## References

- [Kimi Code API Docs](https://www.kimi.com/code/docs/more/third-party-agents.html)
- [pi-mono](https://github.com/badlogic/pi-mono) - Original implementation
