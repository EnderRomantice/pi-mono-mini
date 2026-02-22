import { NextRequest } from 'next/server';
import { initChatManager, addClient } from '@/lib/chat';

let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await initChatManager();
    initialized = true;
  }
}

// GET /api/events - Server-Sent Events stream
export async function GET(req: NextRequest) {
  await ensureInitialized();
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));
      
      // Add client to broadcast list
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (e) {
          // Stream closed
        }
      };
      
      const removeClient = addClient(send);
      
      // Clean up on close
      req.signal.addEventListener('abort', () => {
        removeClient();
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
