/**
 * Chat Infrastructure Package
 * 
 * Provides state management, session lifecycle, and event system for chat applications.
 * UI implementations should use these abstractions and provide their own presentation layer.
 * 
 * Example usage:
 * ```typescript
 * import { SessionManager, type ChatAdapter } from './chat/index.js';
 * 
 * const manager = new SessionManager({ dataDir: '.pi/chat' });
 * await manager.init();
 * 
 * const sessionId = await manager.createSession({ title: 'My Chat' });
 * manager.activateSession(sessionId);
 * 
 * // Send message
 * await manager.sendMessage(sessionId, 'Hello!');
 * 
 * // Listen to events
 * manager.on('message:sent', ({ message }) => {
 *   console.log('Assistant:', message.content);
 * });
 * ```
 */

export * from './types.js';
export * from './manager.js';

// Re-export core types for convenience
export { Agent, type Tool, type Message } from '../core/index.js';
