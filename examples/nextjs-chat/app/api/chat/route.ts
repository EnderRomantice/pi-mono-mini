import { NextRequest, NextResponse } from 'next/server';
import { initChatManager, getManager } from '@/lib/chat';

// Initialize on first request
let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (initialized) return;
  
  if (!initPromise) {
    initPromise = initChatManager().then(() => {
      initialized = true;
    });
  }
  
  await initPromise;
}

// GET /api/chat - Get sessions or messages
export async function GET(req: NextRequest) {
  try {
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
  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/chat - Create session or send message
export async function POST(req: NextRequest) {
  try {
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
      
      const message = await manager.sendMessage(sessionId, content);
      return NextResponse.json({ message });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    console.error('API Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
