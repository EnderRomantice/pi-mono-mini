/**
 * Chat Infrastructure Types
 * 
 * Core abstractions for chat state management and session lifecycle.
 * UI implementations should adapt these types to their specific interface.
 */

import type { Message, Tool } from '../core/types.js';

// ============================================================================
// Session State
// ============================================================================

export type SessionStatus = 'idle' | 'active' | 'paused' | 'closed';

export interface SessionState {
  id: string;
  status: SessionStatus;
  messages: ChatMessage[];
  metadata: SessionMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface SessionMetadata {
  title?: string;
  systemPrompt?: string;
  tags?: string[];
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    tokens?: number;
    toolCalls?: any[];
    [key: string]: any;
  };
}

// ============================================================================
// Events
// ============================================================================

export interface ChatEvents {
  // Manager lifecycle
  'manager:ready': {};
  
  // Session lifecycle
  'session:created': { sessionId: string };
  'session:activated': { sessionId: string };
  'session:paused': { sessionId: string };
  'session:closed': { sessionId: string };
  
  // Message events
  'message:received': { sessionId: string; message: ChatMessage };
  'message:sent': { sessionId: string; message: ChatMessage };
  'message:streaming': { sessionId: string; chunk: string };
  
  // Stream events (for streaming responses)
  'stream:start': { sessionId: string };
  'stream:chunk': { sessionId: string; chunk: string };
  'stream:end': { sessionId: string };
  
  // State changes
  'state:changed': { sessionId: string; prev: SessionState; current: SessionState };
  'error': { sessionId: string; error: Error };
}

export type ChatEventName = keyof ChatEvents;
export type ChatEventHandler<T extends ChatEventName> = (payload: ChatEvents[T]) => void;

// ============================================================================
// Adapter Interface
// ============================================================================

/**
 * Forward reference for SessionManager (avoids circular dependency)
 */
export type SessionManagerRef = {
  getSession(sessionId: string): SessionState | undefined;
  getActiveSession(): SessionState | undefined;
  getActiveSessionId(): string | undefined;
  listSessions(): SessionState[];
  getMessages(sessionId: string): ChatMessage[];
  sendMessage(sessionId: string, content: string): Promise<ChatMessage>;
  createSession(options?: any): Promise<string>;
  activateSession(sessionId: string): void;
  closeSession(sessionId: string): Promise<void>;
  on<T extends ChatEventName>(event: T, handler: ChatEventHandler<T>): any;
};

/**
 * UI Adapter interface
 * Implementations handle the actual presentation layer (CLI, Web, GUI, etc.)
 */
export interface ChatAdapter {
  /** Initialize the adapter */
  init(manager: SessionManagerRef): void;
  
  /** Display a message */
  displayMessage(message: ChatMessage): void;
  
  /** Display a system notification */
  displayNotification(type: 'info' | 'warning' | 'error', message: string): void;
  
  /** Update session status indicator */
  updateStatus(sessionId: string, status: SessionStatus): void;
  
  /** Handle user input (called by the adapter implementation) */
  onInput?(input: string, sessionId?: string): void;
  
  /** Cleanup resources */
  dispose(): void;
}

// ============================================================================
// Configuration
// ============================================================================

export interface SessionManagerConfig {
  /** Storage directory for persistent sessions */
  dataDir?: string;
  
  /** Default system prompt */
  defaultSystemPrompt?: string;
  
  /** Maximum messages per session */
  maxMessagesPerSession?: number;
  
  /** Tools available to all sessions */
  defaultTools?: Tool[];
  
  /** LLM configuration */
  llm?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface CreateSessionOptions {
  id?: string;
  title?: string;
  systemPrompt?: string;
  metadata?: Partial<SessionMetadata>;
  tools?: Tool[];
}
