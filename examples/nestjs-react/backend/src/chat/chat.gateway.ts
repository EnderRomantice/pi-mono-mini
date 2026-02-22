import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service.js';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    console.log('[WebSocket] Client connected:', client.id);
    
    if (!this.chatService) {
      console.error('[WebSocket] ChatService not injected!');
      client.emit('error', { message: 'Internal server error' });
      return;
    }
    
    if (!this.chatService.isReady()) {
      client.emit('error', { message: 'Service not configured' });
      return;
    }

    try {
      const manager = this.chatService.getManager();
      
      // Listen to chat events and forward to client
      const onMessageReceived = ({ sessionId, message }: { sessionId: string; message: any }) => {
        client.emit('message:received', { sessionId, message });
      };

      const onMessageSent = ({ sessionId, message }: { sessionId: string; message: any }) => {
        client.emit('message:sent', { sessionId, message });
      };

      const onStreamStart = ({ sessionId }: { sessionId: string }) => {
        client.emit('stream:start', { sessionId });
      };

      const onStreamChunk = ({ sessionId, chunk }: { sessionId: string; chunk: string }) => {
        client.emit('stream:chunk', { sessionId, chunk });
      };

      const onStreamEnd = ({ sessionId }: { sessionId: string }) => {
        client.emit('stream:end', { sessionId });
      };

      const onProactive = (task: any) => {
        console.log('[WebSocket] Sending proactive task to client:', task.taskName);
        client.emit('proactive', {
          taskName: task.taskName,
          prompt: task.prompt,
          timestamp: Date.now(),
        });
      };

      manager.on('message:received', onMessageReceived);
      manager.on('message:sent', onMessageSent);
      manager.on('stream:start', onStreamStart);
      manager.on('stream:chunk', onStreamChunk);
      manager.on('stream:end', onStreamEnd);

      // Proactive events - subscribe to watcher for all processed tasks
      const proactive = this.chatService.getProactive();
      proactive.watcher.on('processed', onProactive);

      // Clean up on disconnect
      client.on('disconnect', () => {
        manager.off('message:received', onMessageReceived);
        manager.off('message:sent', onMessageSent);
        manager.off('stream:start', onStreamStart);
        manager.off('stream:chunk', onStreamChunk);
        manager.off('stream:end', onStreamEnd);
      proactive.watcher.off('processed', onProactive);
      });

      client.emit('connected', { status: 'ok' });
    } catch (err: any) {
      console.error('[WebSocket] Error in handleConnection:', err?.message);
      client.emit('error', { message: err?.message || 'Unknown error' });
    }
  }

  handleDisconnect(client: Socket) {
    console.log('[WebSocket] Client disconnected:', client.id);
  }
}
