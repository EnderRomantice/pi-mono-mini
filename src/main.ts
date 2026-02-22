/**
 * pi-mono-mini - Phase 1
 * Minimal ReAct Agent
 * 
 * Usage:
 *   # Set API key in .env file, then:
 *   npm start
 */

import 'dotenv/config';  // Load .env file
import { Agent } from './agent.js';
import { calculatorTool } from './tools/calculator.js';
import { getLLMConfigFromEnv } from './llm.js';

async function main() {
  // Get LLM config from environment
  let llmConfig;
  try {
    llmConfig = getLLMConfigFromEnv();
  } catch (error: any) {
    console.error('❌', error.message);
    console.error('\nPlease set one of:');
    console.error('  export KIMI_API_KEY=your-key  # For Moonshot/Kimi');
    console.error('  export OPENAI_API_KEY=sk-...  # For OpenAI');
    process.exit(1);
  }

  console.log('🚀 pi-mono-mini - Phase 1');
  console.log(`   Using model: ${llmConfig.model}`);
  console.log('=========================\n');

  // Create agent with calculator tool
  const agent = new Agent(
    {
      systemPrompt: 'You are a helpful assistant that can perform calculations.',
      llm: llmConfig,
      maxIterations: 5,
    },
    [calculatorTool]
  );

  // Demo 1: Simple calculation
  console.log('Demo 1: Simple calculation');
  console.log('--------------------------');
  const result1 = await agent.run('What is 123 multiplied by 456?');
  console.log('\n🤖 Final answer:', result1);
  
  console.log('\n\n');
  
  // Clear history for next demo
  agent.clear();
  
  // Demo 2: Multi-step calculation
  console.log('Demo 2: Multi-step calculation');
  console.log('------------------------------');
  const result2 = await agent.run('Calculate (100 + 200) * 3, then add 50 to the result');
  console.log('\n🤖 Final answer:', result2);

  console.log('\n\n✨ Phase 1 complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
