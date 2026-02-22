/**
 * Schedule Reminder Tool
 * Allows agent to set reminders for users
 */

import type { Tool } from 'pi-mono-mini/core/types.js';
import type { ProactiveAgent } from 'pi-mono-mini/proactive/index.js';

// Mutable reference to be set after initialization
export const proactiveRef: { current?: ProactiveAgent } = {};

export function createScheduleTool(): Tool {
  return {
    name: 'schedule_reminder',
    description: `IMPORTANT: You MUST call this tool when the user asks you to remind them about something later.
Call this tool immediately when user says things like:
- "remind me in X minutes/hours" (e.g., "remind me in 5 minutes")
- "call me after X minutes" (e.g., "call me after 10 minutes")
- "notify me at X" (e.g., "notify me at 3pm")
- "五分钟后提醒我..." / "一小时后叫我" / "十分钟后通知我"
- "X分钟后/小时后提醒我[做某事]"

DO NOT just say you will remind them. You MUST use this tool to actually schedule the reminder.`,
    parameters: {
      type: 'object',
      properties: {
        delay_minutes: {
          type: 'number',
          description: 'Number of minutes from now to wait before reminding. Examples: 5 for "5 minutes", 60 for "1 hour".',
        },
        specific_time: {
          type: 'string',
          description: 'Specific time in ISO 8601 format. Use this for absolute time like "3pm tomorrow".',
        },
        reminder_text: {
          type: 'string',
          description: 'What to remind the user about. Extract from user message. Example: "take out the trash"',
        },
      },
      required: ['reminder_text'],
    },
    async execute(args: { delay_minutes?: number; specific_time?: string; reminder_text?: string }): Promise<string> {
      if (!args?.reminder_text) {
        throw new Error('Missing reminder_text');
      }

      if (!proactiveRef.current) {
        throw new Error('Proactive agent not initialized');
      }

      let triggerAt: Date;

      if (args.delay_minutes !== undefined && args.delay_minutes > 0) {
        // Relative time
        triggerAt = new Date(Date.now() + args.delay_minutes * 60 * 1000);
      } else if (args.specific_time) {
        // Absolute time
        triggerAt = new Date(args.specific_time);
        if (isNaN(triggerAt.getTime())) {
          throw new Error(`Invalid specific_time: ${args.specific_time}`);
        }
      } else {
        throw new Error('Must provide either delay_minutes or specific_time');
      }

      // Schedule the task
      await proactiveRef.current.schedule({
        type: 'scheduled',
        name: `reminder-${Date.now()}`,
        description: args.reminder_text,
        trigger: { at: triggerAt.toISOString() },
        action: { prompt: `⏰ Reminder: ${args.reminder_text}` },
        enabled: true,
      });

      const delayMs = triggerAt.getTime() - Date.now();
      const delaySec = Math.round(delayMs / 1000);

      if (delaySec < 60) {
        return `✅ Reminder set! I'll notify you in ${delaySec} seconds.`;
      } else if (delaySec < 3600) {
        return `✅ Reminder set! I'll notify you in ${Math.round(delaySec / 60)} minutes.`;
      } else {
        return `✅ Reminder set! I'll notify you at ${triggerAt.toLocaleString()}.`;
      }
    },
  };
}
