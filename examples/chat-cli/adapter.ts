/**
 * CLI Adapter - Terminal UI Implementation
 * 
 * Implements ChatAdapter for terminal/command-line interface.
 * This is a reference UI implementation, not core infrastructure.
 */

import * as readline from 'readline';
import type {
  ChatAdapter,
  SessionManagerRef,
  ChatMessage,
  SessionStatus,
} from '../../src/chat/index.js';

export interface CLIAdapterOptions {
  prompt?: string;
  showTimestamps?: boolean;
  maxHistoryPreview?: number;
}

export class CLIAdapter implements ChatAdapter {
  private manager?: SessionManagerRef;
  private rl?: readline.Interface;
  private options: Required<CLIAdapterOptions>;
  private isRunning = false;

  // Command handlers
  private commands: Map<string, (args: string[]) => void | Promise<void>> = new Map();

  constructor(options: CLIAdapterOptions = {}) {
    this.options = {
      prompt: '> ',
      showTimestamps: false,
      maxHistoryPreview: 50,
      ...options,
    };
  }

  init(manager: SessionManagerRef): void {
    this.manager = manager;
    this.setupCommands();
  }

  /**
   * Start the CLI interface
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.options.prompt,
    });

    this.isRunning = true;
    
    console.log('🚀 Chat CLI started!');
    console.log('Type /help for commands, /quit to exit.\n');
    
    this.showSessionList();
    this.rl.prompt();

    this.rl.on('line', (input) => this.handleInput(input));
    this.rl.on('close', () => this.dispose());

    return new Promise((resolve) => {
      this.rl?.on('close', resolve);
    });
  }

  // ========================================================================
  // ChatAdapter Implementation
  // ========================================================================

  displayMessage(message: ChatMessage): void {
    const prefix = message.role === 'user' ? '👤' : 
                   message.role === 'assistant' ? '🤖' : '⚙️';
    
    let output = `${prefix} ${message.content}`;
    
    if (this.options.showTimestamps) {
      const time = new Date(message.timestamp).toLocaleTimeString();
      output = `[${time}] ${output}`;
    }
    
    console.log(`\n${output}\n`);
    this.rl?.prompt();
  }

  displayNotification(type: 'info' | 'warning' | 'error', message: string): void {
    const icons = { info: 'ℹ️', warning: '⚠️', error: '❌' };
    console.log(`\n${icons[type]} ${message}\n`);
    this.rl?.prompt();
  }

  updateStatus(sessionId: string, status: SessionStatus): void {
    // Could update prompt or title bar here
    if (status === 'active') {
      const session = this.manager?.getSession(sessionId);
      if (session) {
        this.rl?.setPrompt(`[${session.metadata.title}] ${this.options.prompt}`);
      }
    }
  }

  dispose(): void {
    this.isRunning = false;
    this.rl?.close();
    console.log('\n👋 Goodbye!\n');
  }

  // ========================================================================
  // Command Handling
  // ========================================================================

  private setupCommands(): void {
    this.commands.set('/help', () => this.showHelp());
    this.commands.set('/sessions', () => this.showSessionList());
    this.commands.set('/new', (args) => this.createSession(args.join(' ')));
    this.commands.set('/switch', (args) => this.switchSession(args[0]));
    this.commands.set('/close', () => this.closeCurrentSession());
    this.commands.set('/history', () => this.showHistory());
    this.commands.set('/clear', () => this.clearSession());
    this.commands.set('/quit', () => this.dispose());
    this.commands.set('/exit', () => this.dispose());
  }

  private async handleInput(input: string): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed) {
      this.rl?.prompt();
      return;
    }

    // Check if it's a command
    if (trimmed.startsWith('/')) {
      const [cmd, ...args] = trimmed.split(' ');
      const handler = this.commands.get(cmd);
      
      if (handler) {
        try {
          await handler(args);
        } catch (e: any) {
          this.displayNotification('error', e.message);
        }
      } else {
        this.displayNotification('error', `Unknown command: ${cmd}. Type /help for available commands.`);
      }
    } else {
      // Regular message
      await this.sendMessage(trimmed);
    }

    if (this.isRunning) {
      this.rl?.prompt();
    }
  }

  private async sendMessage(content: string): Promise<void> {
    const sessionId = this.manager?.getActiveSessionId();
    
    if (!sessionId) {
      // Auto-create session if none exists
      const newSessionId = await this.manager?.createSession();
      if (newSessionId) {
        this.manager?.activateSession(newSessionId);
        console.log(`Created new session: ${newSessionId}\n`);
      }
    }

    const activeId = this.manager?.getActiveSessionId();
    if (!activeId) {
      this.displayNotification('error', 'No active session');
      return;
    }

    try {
      await this.manager?.sendMessage(activeId, content);
    } catch (e: any) {
      this.displayNotification('error', e.message);
    }
  }

  // ========================================================================
  // Commands
  // ========================================================================

  private showHelp(): void {
    console.log(`
📖 Available Commands:
----------------------
  /sessions              List all sessions
  /new [title]           Create a new session
  /switch <id>           Switch to a session
  /close                 Close current session
  /history               Show conversation history
  /clear                 Clear current session
  /quit, /exit           Exit the CLI

Type any message to send it to the active session.
`);
  }

  private showSessionList(): void {
    const sessions = this.manager?.listSessions() || [];
    const activeId = this.manager?.getActiveSessionId();

    if (sessions.length === 0) {
      console.log('\n📭 No sessions. Type /new to create one.\n');
      return;
    }

    console.log('\n📂 Sessions:');
    console.log('------------');
    sessions.forEach(s => {
      const marker = s.id === activeId ? '▶️' : '  ';
      const status = s.status === 'active' ? '(active)' : `(${s.status})`;
      console.log(`  ${marker} ${s.id.slice(0, 8)}... ${s.metadata.title} ${status}`);
    });
    console.log();
  }

  private async createSession(title?: string): Promise<void> {
    const sessionId = await this.manager?.createSession(title ? { title } : undefined);
    if (sessionId) {
      this.manager?.activateSession(sessionId);
      console.log(`\n✅ Created session: ${sessionId}\n`);
    }
  }

  private async switchSession(id?: string): Promise<void> {
    if (!id) {
      this.showSessionList();
      return;
    }

    // Allow partial matching
    const sessions = this.manager?.listSessions() || [];
    const match = sessions.find(s => s.id.startsWith(id));
    
    if (!match) {
      this.displayNotification('error', `Session not found: ${id}`);
      return;
    }

    this.manager?.activateSession(match.id);
    console.log(`\n▶️  Switched to session: ${match.metadata.title}\n`);
  }

  private async closeCurrentSession(): Promise<void> {
    const activeId = this.manager?.getActiveSessionId();
    if (!activeId) {
      this.displayNotification('warning', 'No active session');
      return;
    }

    await this.manager?.closeSession(activeId);
    console.log('\n🗑️  Session closed\n');
    
    // Show remaining sessions or create new one
    const remaining = this.manager?.listSessions().filter(s => s.status !== 'closed') || [];
    if (remaining.length > 0) {
      this.showSessionList();
    } else {
      console.log('No active sessions. Type /new to create one.\n');
    }
  }

  private showHistory(): void {
    const activeId = this.manager?.getActiveSessionId();
    if (!activeId) {
      this.displayNotification('warning', 'No active session');
      return;
    }

    const messages = this.manager?.getMessages(activeId) || [];
    if (messages.length === 0) {
      console.log('\n📭 No messages yet\n');
      return;
    }

    console.log('\n📜 History:');
    console.log('-----------');
    messages.forEach((m, i) => {
      const role = m.role === 'user' ? '👤' : m.role === 'assistant' ? '🤖' : '⚙️';
      const preview = m.content.slice(0, this.options.maxHistoryPreview).replace(/\n/g, ' ');
      const suffix = m.content.length > this.options.maxHistoryPreview ? '...' : '';
      console.log(`  ${i + 1}. ${role} ${preview}${suffix}`);
    });
    console.log(`\n  Total: ${messages.length} messages\n`);
  }

  private clearSession(): void {
    const activeId = this.manager?.getActiveSessionId();
    if (!activeId) {
      this.displayNotification('warning', 'No active session');
      return;
    }

    // Close and recreate
    this.manager?.closeSession(activeId).then(() => {
      return this.manager?.createSession();
    }).then(newId => {
      if (newId) this.manager?.activateSession(newId);
      console.log('\n🗑️  Session cleared\n');
    });
  }
}
