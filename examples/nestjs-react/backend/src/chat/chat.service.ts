import { Injectable, OnModuleInit } from '@nestjs/common';
import { SessionManager } from 'pi-mono-mini/chat/index.js';
import { Agent, getLLMConfigFromEnv } from 'pi-mono-mini/core/index.js';
import { ProactiveAgent } from 'pi-mono-mini/proactive/index.js';
import { createScheduleTool, proactiveRef } from '../tools/schedule.tool.js';

@Injectable()
export class ChatService implements OnModuleInit {
  private manager!: SessionManager;
  private globalAgent!: Agent;
  private proactive!: ProactiveAgent;
  private isInitialized = false;

  async onModuleInit() {
    // Skip if no API key configured
    try {
      // Debug: log env vars (masked)
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      const kimiKey = process.env.KIMI_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      console.log('[ChatService] Env check:', {
        DEEPSEEK_API_KEY: deepseekKey ? 'set (' + deepseekKey.slice(0, 10) + '...)' : 'not set',
        KIMI_API_KEY: kimiKey ? 'set (' + kimiKey.slice(0, 10) + '...)' : 'not set',
        OPENAI_API_KEY: openaiKey ? 'set (' + openaiKey.slice(0, 10) + '...)' : 'not set',
      });
      
      const llmConfig = getLLMConfigFromEnv();
      
      // Create global agent first (for proactive tasks)
      this.globalAgent = new Agent({
        systemPrompt: `You are a helpful assistant with the ability to set reminders.

CRITICAL: When a user asks you to remind them about something later, you MUST call the schedule_reminder tool. Do NOT just say you will remind them - you must actually use the tool to schedule it.

Examples when you MUST call schedule_reminder:
- User: "remind me in 5 minutes" → Call tool with delay_minutes=5
- User: "一分钟后提醒我" → Call tool with delay_minutes=1  
- User: "十分钟后叫我倒垃圾" → Call tool with delay_minutes=10, reminder_text="倒垃圾"
- User: "一小时后通知我" → Call tool with delay_minutes=60

Be concise and friendly. After scheduling, confirm the reminder has been set.`,
        llm: llmConfig,
        maxIterations: 10,
      }, []);
      
      // Create proactive agent first (needed by schedule tool)
      this.proactive = new ProactiveAgent(this.globalAgent, {
        dataDir: '.pi/nestjs-chat/proactive',
        autoStart: true,
      });
      await this.proactive.init();
      
      // Set the reference BEFORE creating SessionManager
      proactiveRef.current = this.proactive;
      
      // Create schedule tool - must be done AFTER proactiveRef is set
      const scheduleTool = createScheduleTool();
      
      // Register tool to globalAgent (for proactive task execution)
      this.globalAgent.registerTool(scheduleTool);

      // Create SessionManager with defaultTools so every session agent has the schedule_reminder tool
      this.manager = new SessionManager({
        dataDir: '.pi/nestjs-chat',
        defaultSystemPrompt: `You are a helpful assistant with the ability to set reminders.

CRITICAL: When a user asks you to remind them about something later, you MUST call the schedule_reminder tool. Do NOT just say you will remind them - you must actually use the tool to schedule it.

Examples when you MUST call schedule_reminder:
- User: "remind me in 5 minutes" → Call tool with delay_minutes=5
- User: "一分钟后提醒我" → Call tool with delay_minutes=1  
- User: "十分钟后叫我倒垃圾" → Call tool with delay_minutes=10, reminder_text="倒垃圾"
- User: "一小时后通知我" → Call tool with delay_minutes=60

Be concise and friendly. After scheduling, confirm the reminder has been set.`,
        defaultTools: [scheduleTool], // CRITICAL: Pass schedule tool to all session agents
      });
      await this.manager.init();

      // Create default session
      const sessions = this.manager.listSessions().filter(s => s.status !== 'closed');
      if (sessions.length === 0) {
        const sessionId = await this.manager.createSession();
        this.manager.activateSession(sessionId);
      }

      this.isInitialized = true;
      console.log('[ChatService] Initialized successfully');
    } catch (e: any) {
      console.warn('[ChatService] Initialization skipped:', e?.message || String(e));
    }
  }

  // Handle message - agent decides what to do (including scheduling)
  async handleMessage(sessionId: string, content: string): Promise<{ scheduled?: boolean }> {
    // Let the agent handle everything (conversation + tool calls)
    const result = await this.manager.sendMessage(sessionId, content);
    
    // Auto-generate title if still using default format
    const session = this.manager.getSession(sessionId);
    if (session && session.metadata.title?.startsWith('新会话#')) {
      try {
        const newTitle = await this.manager.generateTitle(sessionId);
        await this.manager.updateSessionMetadata(sessionId, { title: newTitle });
      } catch (e) {
        // Ignore title generation errors
      }
    }
    
    return { scheduled: false };
  }

  getManager() {
    if (!this.isInitialized) {
      throw new Error('Chat service not initialized. Please configure API key.');
    }
    return this.manager;
  }

  getProactive() {
    if (!this.isInitialized) {
      throw new Error('Chat service not initialized. Please configure API key.');
    }
    return this.proactive;
  }

  getGlobalAgent() {
    if (!this.isInitialized) {
      throw new Error('Chat service not initialized. Please configure API key.');
    }
    return this.globalAgent;
  }

  isReady() {
    return this.isInitialized;
  }
}
