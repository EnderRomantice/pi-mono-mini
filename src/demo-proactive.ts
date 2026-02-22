/**
 * Proactive Agent Demo
 * 
 * Demonstrates:
 * 1. User interacts with agent normally
 * 2. Scheduled task triggers automatically
 * 3. Agent handles proactive task like a user message
 */

import 'dotenv/config';
import { Agent, getLLMConfigFromEnv } from './core/index.js';
import { ProactiveAgent } from './proactive/index.js';

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // Setup
  const llmConfig = getLLMConfigFromEnv();
  
  console.log('🚀 pi-mono-mini with Proactive Agent');
  console.log(`   Model: ${llmConfig.model}`);
  console.log('=====================================\n');

  // Create base agent
  const agent = new Agent(
    {
      systemPrompt: 'You are a helpful assistant.',
      llm: llmConfig,
      maxIterations: 5,
    },
    []
  );

  // Wrap with proactive capabilities
  const proactive = new ProactiveAgent(agent, {
    dataDir: '.pi/proactive',
    autoStart: true,
  });

  await proactive.init();

  // Schedule a task to trigger in 5 seconds
  console.log('📅 Scheduling a task to trigger in 5 seconds...\n');
  
  await proactive.schedule({
    type: 'scheduled',
    name: 'periodic-check',
    description: 'A demo proactive task',
    trigger: {
      at: new Date(Date.now() + 5000).toISOString(), // 5 seconds from now
    },
    action: {
      prompt: 'Tell me a short joke.',
    },
    enabled: true,
  });

  // User interacts with agent while waiting
  console.log('👤 User starts interaction:');
  console.log('----------------------------');
  
  const result1 = await agent.run('Hello! Who are you?');
  console.log('\n🤖 Agent:', result1);

  console.log('\n⏳ Waiting for proactive task to trigger...\n');

  // Wait and let the proactive task trigger
  await sleep(8000);

  console.log('\n📊 Final state:');
  console.log('----------------');
  console.log('Tasks scheduled:', proactive.listTasks().length);
  console.log('Agent messages:', agent.getMessages().length);
  
  // Show all messages
  console.log('\n📜 Conversation history:');
  agent.getMessages().forEach((m, i) => {
    const content = m.content.slice(0, 60).replace(/\n/g, ' ');
    console.log(`  ${i}: [${m.role}] ${content}...`);
  });

  proactive.stop();
  console.log('\n✨ Demo complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
