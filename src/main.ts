#!/usr/bin/env node
/**
 * pi-mono-mini - Entry point
 * 
 * Starts the interactive chat CLI.
 * For the full CLI with multi-session support, use: npm run example:chat
 */

import 'dotenv/config';
import { SessionManager } from './chat/index.js';

async function main() {
  // Simple single-session chat for quick start
  const manager = new SessionManager({
    dataDir: '.pi/chat',
    defaultSystemPrompt: 'You are a helpful AI assistant.',
  });

  await manager.init();

  // Create default session
  const sessionId = await manager.createSession({ title: 'Default' });
  manager.activateSession(sessionId);

  // Listen for responses
  manager.on('message:sent', ({ message }) => {
    console.log(`\n🤖 ${message.content}\n`);
  });

  // Simple prompt-based interface
  console.log('🚀 Chat started! Type your message (Ctrl+C to exit).\n');
  
  const { createInterface } = await import('readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed === '/quit') {
      rl.close();
      return;
    }

    console.log('🤖 Thinking...');
    try {
      await manager.sendMessage(sessionId, trimmed);
    } catch (e: any) {
      console.error('❌ Error:', e.message);
    }
    
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n👋 Goodbye!\n');
    process.exit(0);
  });
}

main().catch((error: any) => {
  console.error('❌ Failed to start:', error.message);
  console.error('\nPlease check your environment variables:');
  console.error('  export DEEPSEEK_API_KEY=sk-...  # or KIMI_API_KEY, OPENAI_API_KEY');
  process.exit(1);
});
