/**
 * Core types for pi-mono-mini
 * Phase 1: Basic ReAct Loop types
 */

// Message roles in conversation
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

// Tool call from LLM
export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

// Base message interface
export interface Message {
  role: MessageRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// Tool definition
export interface Tool {
  name: string;
  description: string;
  parameters: object; // JSON Schema
  execute: (args: any) => Promise<string>;
}

// LLM response structure
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[] | undefined;
}

// LLM Provider configuration
export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

// Agent configuration
export interface AgentConfig {
  systemPrompt: string;
  llm: LLMConfig;
  maxIterations?: number; // Prevent infinite loops
}
