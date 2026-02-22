/**
 * Backend Chat & Proactive Manager
 * 
 * Runs on Node.js server, manages sessions and proactive tasks.
 * Notifies connected clients via Server-Sent Events.
 */

import { SessionManager } from 'pi-mono-mini/chat/index';
import { Agent, getLLMConfigFromEnv } from 'pi-mono-mini/core/index';
import { ProactiveAgent } from 'pi-mono-mini/proactive/index';
import type { PendingTask } from 'pi-mono-mini/proactive/watcher';

// Singleton instances
let manager: SessionManager | null = null;
let globalAgent: Agent | null = null;
let proactive: ProactiveAgent | null = null;

// Connected clients for SSE
const clients = new Set<(data: any) => void>();

export async function initChatManager() {
  console.log('[ChatManager] Initializing...');
  
  if (manager) {
    console.log('[ChatManager] Already initialized');
    return { manager, proactive, globalAgent };
  }

  try {
    // Get LLM config
    const llmConfig = getLLMConfigFromEnv();
    console.log('[ChatManager] LLM Config loaded:', llmConfig.model);

    // Create a shared agent for proactive tasks
    globalAgent = new Agent({
      systemPrompt: 'You are a helpful assistant.',
      llm: llmConfig,
      maxIterations: 10,
    }, []);
    console.log('[ChatManager] Global agent created');

    // Initialize SessionManager
    manager = new SessionManager({
      dataDir: '.pi/nextjs-chat',
      defaultSystemPrompt: 'You are a helpful assistant.',
    });
    await manager.init();
    console.log('[ChatManager] SessionManager initialized');

    // Create default session if none exists
    const sessions = manager.listSessions().filter(s => s.status !== 'closed');
    if (sessions.length === 0) {
      const sessionId = await manager.createSession({ title: 'Default' });
      manager.activateSession(sessionId);
      console.log('[ChatManager] Default session created:', sessionId);
    } else {
      console.log('[ChatManager] Found existing sessions:', sessions.length);
    }

    // Initialize ProactiveAgent with the shared agent
    proactive = new ProactiveAgent(globalAgent, {
      dataDir: '.pi/nextjs-chat/proactive',
      autoStart: true,
    });
    await proactive.init();
    console.log('[ChatManager] ProactiveAgent initialized');

    // Hook into proactive to broadcast notifications
    proactive.watcher.on('processed', (task: PendingTask) => {
      console.log('[ChatManager] Proactive task triggered:', task.taskName);
      broadcast({
        type: 'proactive',
        task: {
          name: task.taskName,
          prompt: task.prompt,
          timestamp: Date.now(),
        },
      });
    });

    // Hook into chat events
    manager.on('message:sent', ({ sessionId, message }) => {
      broadcast({
        type: 'message',
        sessionId,
        message,
      });
    });

    console.log('[ChatManager] Fully initialized');
    return { manager, proactive, globalAgent };
  } catch (e) {
    console.error('[ChatManager] Initialization failed:', e);
    throw e;
  }
}

// Server-Sent Events helpers
export function addClient(send: (data: any) => void) {
  clients.add(send);
  console.log('[ChatManager] Client connected, total:', clients.size);
  return () => {
    clients.delete(send);
    console.log('[ChatManager] Client disconnected, total:', clients.size);
  };
}

function broadcast(data: any) {
  const json = JSON.stringify(data);
  clients.forEach(send => {
    try {
      send(json);
    } catch (e) {
      // Client disconnected
      clients.delete(send);
    }
  });
}

export function getManager() {
  if (!manager) throw new Error('Chat manager not initialized');
  return manager;
}

export function getProactive() {
  if (!proactive) throw new Error('Proactive not initialized');
  return proactive;
}

export function getGlobalAgent() {
  if (!globalAgent) throw new Error('Agent not initialized');
  return globalAgent;
}
