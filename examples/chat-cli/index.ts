#!/usr/bin/env node
/**
 * Chat CLI Example
 * 
 * A terminal-based chat interface demonstrating the chat infrastructure.
 * This is a reference implementation - you can build your own UI using the same patterns.
 */

import 'dotenv/config';
import { SessionManager } from '../../src/chat/index.js';
import { CLIAdapter } from './adapter.js';

async function main() {
  // Create session manager (infrastructure)
  const manager = new SessionManager({
    dataDir: '.pi/chat',
    defaultSystemPrompt: 'You are a helpful AI assistant.',
  });

  // Initialize
  await manager.init();

  // Create CLI adapter (UI layer)
  const adapter = new CLIAdapter({
    prompt: '> ',
    showTimestamps: false,
  });

  // Connect adapter to manager
  manager.setAdapter(adapter);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    adapter.dispose();
    process.exit(0);
  });

  // Start CLI
  try {
    await adapter.start();
  } catch (error: any) {
    console.error('❌ Failed to start:', error.message);
    console.error('\nPlease check your API key:');
    console.error('  export DEEPSEEK_API_KEY=sk-...');
    process.exit(1);
  }
}

main();
