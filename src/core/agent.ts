/**
 * ReAct Agent for pi-mono-mini
 * Core loop: Reasoning (LLM) -> Acting (Tools) -> Observation (Results)
 * 
 * Phase 2: Added steering support for proactive agent
 */

import type { Message, Tool, LLMResponse, AgentConfig, LLMConfig, ToolCall } from './types.js';
import { complete } from './llm.js';

export class Agent {
  private messages: Message[] = [];
  private tools: Map<string, Tool> = new Map();
  private config: Required<AgentConfig>;
  private llmConfig: LLMConfig;
  private pendingToolCalls: ToolCall[] = [];
  
  // Steering queue for proactive messages
  private steeringQueue: Message[] = [];
  private isRunning: boolean = false;
  private currentResolve?: () => void;

  constructor(config: AgentConfig, tools: Tool[] = []) {
    this.llmConfig = config.llm;
    this.config = {
      maxIterations: 10,
      ...config,
      llm: config.llm,
    };
    
    // Register tools
    tools.forEach(tool => this.tools.set(tool.name, tool));
    
    // Add system prompt
    this.messages.push({
      role: 'system',
      content: this.buildSystemPrompt(),
    });
  }

  /**
   * Run agent with user input (blocking)
   */
  async run(userInput: string): Promise<string> {
    // Wait if already running
    while (this.isRunning) {
      await new Promise(r => setTimeout(r, 100));
    }

    this.addMessage('user', userInput);
    console.log('👤 User:', userInput);
    
    return this.runLoop();
  }

  /**
   * Steer the agent with a new message while it's running or idle
   * Key method for proactive agent - allows external injection of "user" messages
   */
  steer(message: Message): void {
    this.steeringQueue.push(message);
    console.log('[Agent] Message queued for steering');
  }

  /**
   * Continue from current state (used after steer())
   */
  async continue(): Promise<string> {
    if (this.isRunning) {
      console.log('[Agent] Already running');
      return '';
    }
    return this.runLoop();
  }

  /**
   * Core ReAct loop
   */
  private async runLoop(): Promise<string> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    this.isRunning = true;
    let iterations = 0;

    try {
      while (iterations < this.config.maxIterations) {
        iterations++;

        // Check for steering messages first
        if (this.steeringQueue.length > 0) {
          const steerMsg = this.steeringQueue.shift()!;
          this.messages.push(steerMsg);
          console.log('[Agent] Processing steered message:', steerMsg.content?.slice(0, 50) + '...');
        }

        // Check last message role
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg?.role === 'assistant') {
          // Last message was from assistant, need user/tool input
          if (this.steeringQueue.length === 0) {
            // No more steering messages, we're done
            this.isRunning = false;
            return lastMsg.content;
          }
          continue; // Process next steering message
        }

        // Step 1: LLM Reasoning
        console.log('\n🤔 Thinking...');
        const response = await this.callLLM();

        // Step 2: Check for tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          this.pendingToolCalls = response.toolCalls;

          // Add assistant message with tool calls
          this.messages.push({
            role: 'assistant',
            content: response.content || '',
            tool_calls: response.toolCalls.map(tc => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            })),
          });

          // Step 3: Execute tools
          for (const toolCall of response.toolCalls) {
            await this.executeTool(toolCall);
          }

          this.pendingToolCalls = [];
          continue; // Continue loop
        }

        // No tool calls - return final answer
        console.log('\n✅ Done');
        this.messages.push({
          role: 'assistant',
          content: response.content,
        });
        
        this.isRunning = false;
        return response.content;
      }

      throw new Error(`Max iterations (${this.config.maxIterations}) reached`);
    } catch (e) {
      this.isRunning = false;
      throw e;
    }
  }

  /**
   * Call LLM with current context
   */
  private async callLLM(): Promise<LLMResponse> {
    const tools = Array.from(this.tools.values());
    return complete(this.messages, this.llmConfig, tools);
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolCall: ToolCall): Promise<void> {
    const tool = this.tools.get(toolCall.name);
    console.log(`🔧 Tool: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);

    if (!tool) {
      const error = `Error: Tool "${toolCall.name}" not found`;
      console.log('  ❌', error);
      this.addToolResult(toolCall.id, toolCall.name, error);
      return;
    }

    try {
      const result = await tool.execute(toolCall.arguments);
      console.log('  ✅ Result:', result.slice(0, 200) + (result.length > 200 ? '...' : ''));
      this.addToolResult(toolCall.id, toolCall.name, result);
    } catch (error: any) {
      const errorMsg = `Error: ${error.message || String(error)}`;
      console.log('  ❌', errorMsg);
      this.addToolResult(toolCall.id, toolCall.name, errorMsg);
    }
  }

  private addMessage(role: Message['role'], content: string): void {
    this.messages.push({ role, content });
  }

  private addToolResult(toolCallId: string, toolName: string, result: string): void {
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      name: toolName,
      content: result,
    });
  }

  private buildSystemPrompt(): string {
    const toolList = Array.from(this.tools.values())
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');

    return `${this.config.systemPrompt}

Available tools:
${toolList || '(none)'}`;
  }

  /**
   * Register a new tool dynamically
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    // Update system prompt with new tools
    const systemPrompt = this.buildSystemPrompt();
    if (this.messages.length > 0 && this.messages[0]?.role === 'system') {
      this.messages[0]!.content = systemPrompt;
    }
  }

  // Getters for external access
  get state() {
    return {
      isStreaming: this.isRunning,
      messages: this.messages,
      steeringQueueLength: this.steeringQueue.length,
    };
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clear(): void {
    const systemPrompt = this.messages[0];
    this.messages = systemPrompt ? [systemPrompt] : [];
    this.steeringQueue = [];
  }
}
