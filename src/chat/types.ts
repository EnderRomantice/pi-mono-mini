/**
 * Chat types
 */

export interface ChatOptions {
  systemPrompt?: string;
  maxIterations?: number;
  tools?: import('../core/types.js').Tool[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
