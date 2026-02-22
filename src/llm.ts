/**
 * LLM Client for pi-mono-mini
 * Supports: DeepSeek, Kimi (Moonshot), OpenAI
 */

import type { Message, Tool, LLMResponse, LLMConfig } from './types.js';

// Default endpoints
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const KIMI_URL = 'https://api.moonshot.cn/v1/chat/completions';
const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Get LLM config from environment
 * Priority: DEEPSEEK_API_KEY > KIMI_API_KEY > OPENAI_API_KEY
 */
export function getLLMConfigFromEnv(): LLMConfig {
  // 1. DeepSeek
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    return {
      apiKey: deepseekKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || DEEPSEEK_URL,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    };
  }

  // 2. Kimi (Moonshot)
  const kimiKey = process.env.KIMI_API_KEY;
  if (kimiKey) {
    return {
      apiKey: kimiKey,
      baseUrl: process.env.KIMI_BASE_URL || KIMI_URL,
      model: process.env.KIMI_MODEL || 'moonshot-v1-8k',
    };
  }
  
  // 3. OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_URL,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  
  throw new Error(
    'No API key found. Please set one of:\n' +
    '\n  # DeepSeek (推荐)\n' +
    '  export DEEPSEEK_API_KEY=sk-...\n' +
    '\n  # Kimi\n' +
    '  export KIMI_API_KEY=sk-...\n' +
    '\n  # OpenAI\n' +
    '  export OPENAI_API_KEY=sk-...'
  );
}

/**
 * Call LLM with tools support
 */
export async function complete(
  messages: Message[],
  llmConfig: LLMConfig,
  tools?: Tool[]
): Promise<LLMResponse> {
  const { apiKey, baseUrl, model } = llmConfig;
  
  const url = baseUrl || DEFAULT_OPENAI_URL;

  // Convert messages to OpenAI format
  const formattedMessages = messages.map(m => {
    if (m.role === 'tool') {
      // Tool result format
      return {
        role: 'tool',
        tool_call_id: m.tool_call_id,
        name: m.name,
        content: m.content,
      };
    }
    if (m.role === 'assistant' && m.tool_calls) {
      // Assistant with tool calls
      return {
        role: 'assistant',
        content: m.content,
        tool_calls: m.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }
    // Simple message
    return {
      role: m.role,
      content: m.content,
    };
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      tools: tools?.map(toOpenAITool),
      tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return parseLLMResponse(data);
}

/**
 * Convert our Tool format to OpenAI tool format
 */
function toOpenAITool(tool: Tool) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

/**
 * Parse OpenAI-compatible response to our LLMResponse format
 */
function parseLLMResponse(data: any): LLMResponse {
  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error('Invalid LLM response: no choices');
  }

  const message = choice.message;
  
  // Parse tool calls if present
  const toolCalls: import('./types.js').ToolCall[] | undefined = message.tool_calls?.map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: safeJsonParse(tc.function.arguments, {}),
  }));

  return {
    content: message.content || '',
    toolCalls,
  };
}

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse(str: string, fallback: any): any {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
