#!/usr/bin/env node
/**
 * pi-mono-mini - Entry point
 * 
 * Starts the interactive chat CLI.
 * 
 * Usage:
 *   npm start
 * 
 * Or with environment variables:
 *   export DEEPSEEK_API_KEY=sk-...
 *   npm start
 */

import 'dotenv/config';
import { startChat } from './chat/index.js';

async function main() {
  try {
    await startChat({
      systemPrompt: 'You are a helpful AI assistant.',
    });
  } catch (error: any) {
    console.error('❌ Failed to start chat:', error.message);
    console.error('\nPlease check your environment variables:');
    console.error('  export DEEPSEEK_API_KEY=sk-...  # or KIMI_API_KEY, OPENAI_API_KEY');
    process.exit(1);
  }
}

main();
