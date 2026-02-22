/**
 * Chat Session - Manages a single conversation
 */

import { Agent } from '../core/agent.js';
import { getLLMConfigFromEnv } from '../core/llm.js';
import type { Tool } from '../core/types.js';
import type { ChatOptions, ChatMessage } from './types.js';

export class ChatSession {
  private agent: Agent;
  private messages: ChatMessage[] = [];
  private options: Required<ChatOptions>;

  constructor(options: ChatOptions = {}) {
    this.options = {
      systemPrompt: 'You are a helpful AI assistant.',
      maxIterations: 10,
      tools: [],
      ...options,
    };

    const llmConfig = getLLMConfigFromEnv();
    
    this.agent = new Agent(
      {
        systemPrompt: this.options.systemPrompt,
        llm: llmConfig,
        maxIterations: this.options.maxIterations,
      },
      this.options.tools
    );
  }

  /**
   * Send a message and get response
   */
  async send(message: string): Promise<string> {
    // Add to history
    this.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    // Get response from agent
    const response = await this.agent.run(message);

    // Add to history
    this.messages.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });

    return response;
  }

  /**
   * Clear conversation history
   */
  clear(): void {
    this.agent.clear();
    this.messages = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Export conversation as formatted text
   */
  export(format: 'markdown' | 'json' = 'markdown'): string {
    if (format === 'json') {
      return JSON.stringify(this.messages, null, 2);
    }

    return this.messages
      .map(m => {
        const role = m.role === 'user' ? '👤 User' : '🤖 Assistant';
        return `## ${role}\n\n${m.content}\n`;
      })
      .join('\n---\n\n');
  }
}
