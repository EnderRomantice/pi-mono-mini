#!/usr/bin/env node
/**
 * Smart Assistant Example
 * 
 * Combines chat + proactive to create an assistant that can:
 * - Chat normally
 * - Set reminders from natural language
 * - Proactively notify when time is up
 */

import 'dotenv/config';
import * as readline from 'readline';
import { Agent, getLLMConfigFromEnv } from '../../src/core/index.js';
import { ProactiveAgent } from '../../src/proactive/index.js';
import type { PendingTask } from '../../src/proactive/watcher.js';

// Simple intent parser for scheduling
interface ParsedIntent {
  type: 'chat' | 'schedule';
  delayMs?: number;
  reminder?: string;
}

/**
 * Parse user message to detect scheduling intent
 * Examples:
 *   "remind me in 5 seconds to drink water"
 *   "10分钟后叫我" 
 *   "after 30s check my email"
 */
function parseIntent(message: string): ParsedIntent {
  const lower = message.toLowerCase();
  
  // Patterns for scheduling
  const patterns = [
    // English: "remind me in 10 seconds to..."
    /(?:remind me |call me |notify me )?(?:in |after )?(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes?)\s*(?:to |about |that )?(.*)/i,
    // Chinese: "10秒后叫我" / "5分钟后提醒我"
    /(\d+)\s*(秒|分钟|分)后(?:叫我|提醒我|通知我)?(?:要|做)?(.*)/,
  ];
  
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2];
      let reminder = (match[3] || '').trim();
      
      // Convert to milliseconds
      const isMinute = unit === 'm' || unit === 'min' || unit === 'minute' || unit === 'minutes' || unit === '分钟' || unit === '分';
      const delayMs = amount * (isMinute ? 60 : 1) * 1000;
      
      // Default reminder if empty
      if (!reminder) {
        reminder = isMinute ? `${amount} minute reminder` : `${amount} second reminder`;
      }
      
      return { type: 'schedule', delayMs, reminder };
    }
  }
  
  // Default: normal chat
  return { type: 'chat' };
}

/**
 * Smart Assistant combining chat + proactive
 */
class SmartAssistant {
  private agent: Agent;
  private proactive: ProactiveAgent;
  private rl: readline.Interface;
  private proactiveMessages: string[] = [];
  private messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }> = [];

  constructor() {
    const llmConfig = getLLMConfigFromEnv();
    
    // Create base agent
    this.agent = new Agent({
      systemPrompt: `You are a helpful smart assistant. You can:
1. Have normal conversations
2. Set reminders when users ask (e.g., "remind me in 5 seconds to drink water")

Be concise and friendly.`,
      llm: llmConfig,
      maxIterations: 5,
    }, []);

    // Wrap with proactive
    this.proactive = new ProactiveAgent(this.agent, {
      dataDir: '.pi/proactive',
      autoStart: true,
    });

    // Hook into proactive to display notifications
    this.proactive.watcher.on('processed', (task: PendingTask) => {
      const notification = `\n⏰ [Reminder] ${task.prompt}\n`;
      this.proactiveMessages.push(notification);
      console.log(notification);
      this.rl.prompt();
    });

    // Readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '👤 > ',
    });
  }

  async start(): Promise<void> {
    await this.proactive.init();
    
    console.log('🚀 Smart Assistant started!');
    console.log('💡 Try: "remind me in 5 seconds to drink water"');
    console.log('   or: "10秒后叫我"\n');
    
    this.rl.prompt();

    this.rl.on('line', async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
        this.rl.prompt();
        return;
      }

      // Parse intent
      const intent = parseIntent(trimmed);

      if (intent.type === 'schedule' && intent.delayMs && intent.reminder) {
        // Schedule a proactive task
        const triggerAt = new Date(Date.now() + intent.delayMs).toISOString();
        
        await this.proactive.schedule({
          type: 'scheduled',
          name: `reminder-${Date.now()}`,
          description: intent.reminder,
          trigger: { at: triggerAt },
          action: { prompt: intent.reminder },
          enabled: true,
        });

        console.log(`🤖 ✅ Scheduled: "${intent.reminder}" (in ${intent.delayMs / 1000}s)\n`);
      } else {
        // Normal chat
        try {
          console.log('🤖 Thinking...');
          const response = await this.agent.run(trimmed);
          
          // Record to history
          this.messages.push(
            { role: 'user', content: trimmed, timestamp: Date.now() },
            { role: 'assistant', content: response, timestamp: Date.now() }
          );
          
          console.log(`🤖 ${response}\n`);
        } catch (error: any) {
          console.error(`❌ Error: ${error.message}\n`);
        }
      }

      this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.proactive.stop();
      console.log('\n👋 Goodbye!\n');
      process.exit(0);
    });

    return new Promise(() => {}); // Keep running
  }

  private async handleCommand(cmd: string): Promise<void> {
    switch (cmd) {
      case '/help':
        console.log(`\n📖 Commands:`);
        console.log(`  /tasks    - List scheduled tasks`);
        console.log(`  /history  - Show conversation history`);
        console.log(`  /export   - Export conversation (markdown)`);
        console.log(`  /clear    - Clear agent memory`);
        console.log(`  /quit     - Exit\n`);
        break;
      
      case '/tasks':
        const tasks = this.proactive.listTasks();
        if (tasks.length === 0) {
          console.log('\n📭 No scheduled tasks\n');
        } else {
          console.log('\n📅 Scheduled Tasks:');
          tasks.forEach(t => {
            const next = t.nextRun ? new Date(t.nextRun).toLocaleTimeString() : 'N/A';
            console.log(`  • ${t.name}: ${t.action.prompt} (at ${next})`);
          });
          console.log();
        }
        break;
      
      case '/history':
        if (this.messages.length === 0) {
          console.log('\n📭 No messages yet\n');
        } else {
          console.log('\n📜 Conversation History:');
          console.log('-----------------------');
          this.messages.forEach((m, i) => {
            const role = m.role === 'user' ? '👤' : '🤖';
            const preview = m.content.slice(0, 50).replace(/\n/g, ' ');
            console.log(`  ${i + 1}. ${role} ${preview}${m.content.length > 50 ? '...' : ''}`);
          });
          console.log(`\n  Total: ${this.messages.length / 2} exchanges\n`);
        }
        break;
      
      case '/export':
        if (this.messages.length === 0) {
          console.log('\n📭 Nothing to export\n');
        } else {
          const md = this.messages.map(m => {
            const header = m.role === 'user' ? '## 👤 User' : '## 🤖 Assistant';
            return `${header}\n\n${m.content}\n`;
          }).join('\n---\n\n');
          console.log('\n' + md + '\n');
        }
        break;
      
      case '/clear':
        this.agent.clear();
        this.messages = [];
        console.log('\n🗑️  Memory cleared\n');
        break;
      
      case '/quit':
      case '/exit':
        this.rl.close();
        break;
      
      default:
        console.log(`\n❓ Unknown command: ${cmd}. Type /help for available commands.\n`);
    }
  }
}

// Start
async function main() {
  try {
    const assistant = new SmartAssistant();
    await assistant.start();
  } catch (error: any) {
    console.error('❌ Failed to start:', error.message);
    console.error('\nPlease set API key:');
    console.error('  export DEEPSEEK_API_KEY=sk-...');
    process.exit(1);
  }
}

main();
