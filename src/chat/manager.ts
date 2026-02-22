/**
 * Session Manager
 * 
 * Manages multiple chat sessions, their lifecycle, and persistence.
 * This is the core infrastructure - UI implementations should use this.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { mkdir, writeFile, readFile, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type {
  SessionState,
  SessionStatus,
  SessionMetadata,
  ChatMessage,
  ChatEvents,
  ChatEventName,
  ChatEventHandler,
  SessionManagerConfig,
  CreateSessionOptions,
  ChatAdapter,
} from './types.js';
import { Agent, getLLMConfigFromEnv } from '../core/index.js';
import { complete } from '../core/llm.js';
import type { Tool } from '../core/types.js';

export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionState> = new Map();
  private agents: Map<string, Agent> = new Map();
  private activeSessionId: string | undefined = undefined;
  private config: Required<SessionManagerConfig>;
  private adapter?: ChatAdapter;
  private dataDir: string;

  constructor(config: SessionManagerConfig = {}) {
    super();
    this.config = {
      dataDir: '.pi/chat',
      defaultSystemPrompt: 'You are a helpful assistant.',
      maxMessagesPerSession: 1000,
      defaultTools: [],
      llm: {},
      ...config,
    };
    this.dataDir = this.config.dataDir;
  }

  /**
   * Initialize the manager and restore persisted sessions
   */
  async init(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await this.loadSessions();
    this.emit('manager:ready', {});
  }

  /**
   * Set the UI adapter
   */
  setAdapter(adapter: ChatAdapter): void {
    this.adapter = adapter;
    adapter.init(this);
  }

  // ========================================================================
  // Session Lifecycle
  // ========================================================================

  /**
   * Create a new session
   */
  async createSession(options: CreateSessionOptions = {}): Promise<string> {
    const sessionId = options.id || randomUUID();
    const now = Date.now();

    const state: SessionState = {
      id: sessionId,
      status: 'idle',
      messages: [],
      metadata: {
        title: options.title || `New Session #${sessionId.slice(0, 8)}`,
        systemPrompt: options.systemPrompt || this.config.defaultSystemPrompt,
        ...options.metadata,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, state);

    // Create agent for this session
    const llmConfig = getLLMConfigFromEnv();
    const agent = new Agent(
      {
        systemPrompt: state.metadata.systemPrompt!,
        llm: llmConfig,
        maxIterations: 10,
      },
      options.tools || this.config.defaultTools
    );
    this.agents.set(sessionId, agent);

    await this.persistSession(sessionId);
    this.emit('session:created', { sessionId });

    return sessionId;
  }

  /**
   * Activate a session (set as current)
   */
  activateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    this.activeSessionId = sessionId;
    this.updateSessionStatus(sessionId, 'active');
    this.emit('session:activated', { sessionId });
  }

  /**
   * Pause a session (keep state but stop processing)
   */
  pauseSession(sessionId: string): void {
    this.updateSessionStatus(sessionId, 'paused');
    this.emit('session:paused', { sessionId });
  }

  /**
   * Close a session (cleanup resources)
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.updateSessionStatus(sessionId, 'closed');
    this.agents.delete(sessionId);
    
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = undefined;
    }

    await this.persistSession(sessionId);
    this.emit('session:closed', { sessionId });
  }

  /**
   * Delete a session permanently
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.closeSession(sessionId);
    this.sessions.delete(sessionId);
    
    const filePath = join(this.dataDir, `${sessionId}.json`);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  // ========================================================================
  // Message Operations
  // ========================================================================

  /**
   * Send a message to a session and get response
   */
  async sendMessage(sessionId: string, content: string): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status === 'closed') throw new Error('Session is closed');

    const agent = this.agents.get(sessionId);
    if (!agent) throw new Error(`No agent for session ${sessionId}`);

    // Create user message
    const userMessage: ChatMessage = {
      id: randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    session.messages.push(userMessage);
    this.emit('message:received', { sessionId, message: userMessage });
    this.adapter?.displayMessage(userMessage);

    // Emit stream start event
    this.emit('stream:start', { sessionId });

    try {
      // Get response from agent
      const response = await agent.run(content);

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      session.messages.push(assistantMessage);
      this.updateSession(sessionId);
      
      this.emit('message:sent', { sessionId, message: assistantMessage });
      this.adapter?.displayMessage(assistantMessage);

      return assistantMessage;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', { sessionId, error: err });
      throw err;
    } finally {
      // Emit stream end even when generation fails
      this.emit('stream:end', { sessionId });
    }
  }

  /**
   * Add a system message
   */
  addSystemMessage(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const message: ChatMessage = {
      id: randomUUID(),
      role: 'system',
      content,
      timestamp: Date.now(),
    };

    session.messages.push(message);
    this.updateSession(sessionId);
  }

  // ========================================================================
  // Queries
  // ========================================================================

  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSession(): SessionState | undefined {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined;
  }

  getActiveSessionId(): string | undefined {
    return this.activeSessionId;
  }

  listSessions(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  getMessages(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId)?.messages || [];
  }

  // ========================================================================
  // Persistence
  // ========================================================================

  private async persistSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const filePath = join(this.dataDir, `${sessionId}.json`);
    await writeFile(filePath, JSON.stringify(session, null, 2));
  }

  private async loadSessions(): Promise<void> {
    try {
      const files = await readdir(this.dataDir);
      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const content = await readFile(join(this.dataDir, file), 'utf-8');
          const state: SessionState = JSON.parse(content);
          
          // Restore closed sessions as paused
          if (state.status === 'closed') {
            state.status = 'paused';
          }
          
          this.sessions.set(state.id, state);
          
          // Recreate agent
          const llmConfig = getLLMConfigFromEnv();
          const agent = new Agent(
            {
              systemPrompt: state.metadata.systemPrompt || this.config.defaultSystemPrompt,
              llm: llmConfig,
              maxIterations: 10,
            },
            this.config.defaultTools
          );
          
          // Restore message history
          for (const msg of state.messages) {
            // Note: This is a simplified restore - full restore would need more careful handling
          }
          
          this.agents.set(state.id, agent);
        } catch (e) {
          console.error(`Failed to load session ${file}:`, e);
        }
      }
    } catch (e) {
      // Directory might not exist
    }
  }

  // ========================================================================
  // Session Metadata Updates
  // ========================================================================

  /**
   * Update session metadata (title, etc.)
   */
  async updateSessionMetadata(sessionId: string, metadata: Partial<SessionMetadata>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const prev = {
      ...session,
      metadata: { ...session.metadata },
      messages: [...session.messages],
    };
    session.metadata = { ...session.metadata, ...metadata };
    session.updatedAt = Date.now();
    
    await this.persistSession(sessionId);
    this.emit('state:changed', { sessionId, prev, current: session });
  }

  /**
   * Generate a title for the session using a standalone LLM call
   * This does not use the session's agent to avoid polluting chat history
   */
  async generateTitle(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // If no messages yet, return default title
    if (session.messages.length === 0) {
      return `New Session #${sessionId.slice(0, 8)}`;
    }

    // Get first user message as context
    const firstUserMessage = session.messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return `New Session #${sessionId.slice(0, 8)}`;
    }

    try {
      // Use standalone LLM call to avoid polluting agent history
      const llmConfig = getLLMConfigFromEnv();
      const response = await complete(
        [
          {
            role: 'system',
            content: 'You are a title generator. Generate a very short title (3-6 words max) summarizing the user message. Reply with just the title, no quotes or punctuation.',
          },
          {
            role: 'user',
            content: firstUserMessage.content,
          },
        ],
        llmConfig,
        undefined
      );

      const title = response.content.trim().replace(/["']/g, '').slice(0, 50);
      return title || `New Session #${sessionId.slice(0, 8)}`;
    } catch (e) {
      return `New Session #${sessionId.slice(0, 8)}`;
    }
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private updateSessionStatus(sessionId: string, status: SessionState['status']): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const prev = { ...session };
    session.status = status;
    session.updatedAt = Date.now();

    this.emit('state:changed', { sessionId, prev, current: session });
    this.adapter?.updateStatus(sessionId, status);
  }

  private updateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.updatedAt = Date.now();
    this.persistSession(sessionId);
  }

  /**
   * Typed event emitter methods
   */
  on<T extends ChatEventName>(event: T, handler: ChatEventHandler<T>): this {
    return super.on(event, handler);
  }

  emit<T extends ChatEventName>(event: T, payload: ChatEvents[T]): boolean {
    return super.emit(event, payload);
  }
}

