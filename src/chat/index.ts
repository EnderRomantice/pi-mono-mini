/**
 * Chat package - Interactive CLI for pi-mono-mini
 * 
 * Usage:
 *   import { startChat } from './chat/index.js';
 *   await startChat();
 */

export * from './types.js';
export * from './session.js';
export * from './cli.js';

import { ChatCLI } from './cli.js';
import type { ChatOptions } from './types.js';

/**
 * Start interactive chat CLI
 */
export async function startChat(options?: ChatOptions): Promise<void> {
  const cli = new ChatCLI(options);
  await cli.start();
}
