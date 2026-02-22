import { NextRequest, NextResponse } from 'next/server';
import { initChatManager, getProactive } from '../../../lib/chat.js';

let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await initChatManager();
    initialized = true;
  }
}

// GET /api/proactive - List tasks
export async function GET(req: NextRequest) {
  await ensureInitialized();
  
  const proactive = getProactive();
  const tasks = proactive.listTasks();
  
  return NextResponse.json({ tasks });
}

// POST /api/proactive - Create a scheduled task
export async function POST(req: NextRequest) {
  await ensureInitialized();
  
  const body = await req.json();
  const { delaySeconds, prompt, name } = body;
  
  if (!delaySeconds || !prompt) {
    return NextResponse.json(
      { error: 'Missing delaySeconds or prompt' },
      { status: 400 }
    );
  }
  
  try {
    const proactive = getProactive();
    const triggerAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
    
    const task = await proactive.schedule({
      type: 'scheduled',
      name: name || `reminder-${Date.now()}`,
      description: `Reminder: ${prompt}`,
      trigger: { at: triggerAt },
      action: { prompt },
      enabled: true,
    });
    
    return NextResponse.json({ task, scheduledAt: triggerAt });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/proactive?id=xxx - Cancel a task
export async function DELETE(req: NextRequest) {
  await ensureInitialized();
  
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('id');
  
  if (!taskId) {
    return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
  }
  
  try {
    const proactive = getProactive();
    await proactive.scheduler.deleteTask(taskId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
