import { NextRequest, NextResponse } from 'next/server';
import { initChatManager, getManager } from '@/lib/chat.js';

// Initialize on first request
let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await initChatManager();
    initialized = true;
  }
}

// GET /api/chat - Get sessions or messages
export async function GET(req: NextRequest) {
  await ensureInitialized();
  
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  
  if (sessionId) {
    // Get specific session messages
    const manager = getManager();
    const session = manager.getSession(sessionId);
    const messages = manager.getMessages(sessionId);
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    return NextResponse.json({ session, messages });
  }
  
  // List all sessions
  const manager = getManager();
  const sessions = manager.listSessions();
  return NextResponse.json({ sessions });
}

// POST /api/chat - Create session or send message
export async function POST(req: NextRequest) {
  await ensureInitialized();
  
  const body = await req.json();
  const { action } = body;
  
  const manager = getManager();
  
  if (action === 'create') {
    const { title, systemPrompt } = body;
    const sessionId = await manager.createSession({ title, systemPrompt });
    manager.activateSession(sessionId);
    return NextResponse.json({ sessionId });
  }
  
  if (action === 'send') {
    const { sessionId, content } = body;
    
    if (!sessionId || !content) {
      return NextResponse.json(
        { error: 'Missing sessionId or content' }, 
        { status: 400 }
      );
    }
    
    try {
      const message = await manager.sendMessage(sessionId, content);
      return NextResponse.json({ message });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
