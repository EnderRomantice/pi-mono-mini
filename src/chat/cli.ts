/**
 * Interactive Chat CLI
 */

import * as readline from 'readline';
import { ChatSession } from './session.js';
import type { ChatOptions } from './types.js';

const COMMANDS = {
  '/help': 'Show available commands',
  '/clear': 'Clear conversation history',
  '/history': 'Show conversation history',
  '/export': 'Export conversation (markdown)',
  '/export-json': 'Export conversation (JSON)',
  '/quit': 'Exit the chat',
  '/exit': 'Exit the chat',
};

export class ChatCLI {
  private session: ChatSession;
  private rl: readline.Interface;
  private isRunning = false;

  constructor(options: ChatOptions = {}) {
    this.session = new ChatSession(options);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '👤 > ',
    });
  }

  /**
   * Start interactive chat
   */
  async start(): Promise<void> {
    console.log('🚀 Chat started! Type /help for commands, /quit to exit.\n');
    
    this.isRunning = true;
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
      } else {
        // Regular message
        await this.handleMessage(trimmed);
      }

      if (this.isRunning) {
        this.rl.prompt();
      }
    });

    this.rl.on('close', () => {
      this.exit();
    });

    return new Promise((resolve) => {
      this.rl.on('close', resolve);
    });
  }

  /**
   * Handle slash commands
   */
  private async handleCommand(cmd: string): Promise<void> {
    switch (cmd) {
      case '/help':
        this.showHelp();
        break;
      
      case '/clear':
        this.session.clear();
        console.log('🗑️  Conversation cleared.\n');
        break;
      
      case '/history':
        this.showHistory();
        break;
      
      case '/export':
        console.log(this.session.export('markdown'));
        console.log();
        break;
      
      case '/export-json':
        console.log(this.session.export('json'));
        console.log();
        break;
      
      case '/quit':
      case '/exit':
        this.exit();
        break;
      
      default:
        console.log(`❓ Unknown command: ${cmd}. Type /help for available commands.\n`);
    }
  }

  /**
   * Handle user message
   */
  private async handleMessage(message: string): Promise<void> {
    try {
      const response = await this.session.send(message);
      console.log(`\n🤖 ${response}\n`);
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}\n`);
    }
  }

  /**
   * Show help
   */
  private showHelp(): void {
    console.log('\n📖 Available Commands:');
    console.log('---------------------');
    Object.entries(COMMANDS).forEach(([cmd, desc]) => {
      console.log(`  ${cmd.padEnd(12)} ${desc}`);
    });
    console.log();
  }

  /**
   * Show conversation history
   */
  private showHistory(): void {
    const history = this.session.getHistory();
    if (history.length === 0) {
      console.log('📭 No messages yet.\n');
      return;
    }

    console.log('\n📜 Conversation History:');
    console.log('-----------------------');
    history.forEach((m, i) => {
      const role = m.role === 'user' ? '👤' : '🤖';
      const preview = m.content.slice(0, 50).replace(/\n/g, ' ');
      console.log(`  ${i + 1}. ${role} ${preview}...`);
    });
    console.log(`\n  Total: ${history.length / 2} exchanges\n`);
  }

  /**
   * Exit chat
   */
  private exit(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log('\n👋 Goodbye!\n');
    this.rl.close();
  }
}
