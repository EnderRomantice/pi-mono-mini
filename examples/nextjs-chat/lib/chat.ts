/**
 * Backend Chat & Proactive Manager
 * 
 * Runs on Node.js server, manages sessions and proactive tasks.
 * Notifies connected clients via Server-Sent Events.
 */

import { SessionManager } from 'pi-mono-mini/chat/index.js';
import { Agent, getLLMConfigFromEnv } from 'pi-mono-mini/core/index.js';
import { ProactiveAgent } from 'pi-mono-mini/proactive/index.js';
import type { PendingTask } from 'pi-mono-mini/proactive/watcher.js';

// Singleton instances
let manager: SessionManager | null = null;
let globalAgent: Agent | null = null;
let proactive: ProactiveAgent | null = null;

// Connected clients for SSE
const clients = new Set<(data: any) => void>();

export async function initChatManager() {
  if (manager) return { manager, proactive, globalAgent };

  // Get LLM config
  const llmConfig = getLLMConfigFromEnv();

  // Create a shared agent for proactive tasks
  // In production, you might want per-user agents
  globalAgent = new Agent({
    systemPrompt: 'You are a helpful assistant.',
    llm: llmConfig,
    maxIterations: 10,
  }, []);

  // Initialize SessionManager
  manager = new SessionManager({
    dataDir: '.pi/nextjs-chat',
    defaultSystemPrompt: 'You are a helpful assistant.',
  });
  await manager.init();

  // Create default session if none exists
  const sessions = manager.listSessions().filter(s => s.status !== 'closed');
  if (sessions.length === 0) {
    const sessionId = await manager.createSession({ title: 'Default' });
    manager.activateSession(sessionId);
  }

  // Initialize ProactiveAgent with the shared agent
  proactive = new ProactiveAgent(globalAgent, {
    dataDir: '.pi/nextjs-chat/proactive',
    autoStart: true,
  });
  await proactive.init();

  // Hook into proactive to broadcast notifications
  proactive.watcher.on('processed', (task: PendingTask) => {
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

  return { manager, proactive, globalAgent };
}

// Server-Sent Events helpers
export function addClient(send: (data: any) => void) {
  clients.add(send);
  return () => clients.delete(send);
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
