import { Controller, Get, Post, Delete, Body, Param, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ChatService } from './chat.service.js';

@Controller('api/chat')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {
    console.log('[ChatController] ChatService injected:', !!chatService);
  }

  @Get('sessions')
  listSessions() {
    console.log('[ChatController] listSessions, isReady:', this.chatService?.isReady?.());
    if (!this.chatService?.isReady()) {
      throw new HttpException('Service not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const manager = this.chatService.getManager();
    return manager.listSessions();
  }

  @Post('sessions')
  async createSession(@Body() body: { title?: string }) {
    if (!this.chatService?.isReady()) {
      throw new HttpException('Service not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const manager = this.chatService.getManager();
    // Only pass title if provided, otherwise let manager use default format
    const sessionId = await manager.createSession(body.title ? { title: body.title } : {});
    const session = manager.getSession(sessionId);
    return { 
      id: sessionId,
      title: session?.metadata?.title || `新会话#${sessionId.slice(0, 8)}`,
      status: session?.status || 'idle',
      createdAt: session?.createdAt || Date.now(),
      updatedAt: session?.updatedAt || Date.now(),
    };
  }

  @Get('sessions/:id/messages')
  getMessages(@Param('id') sessionId: string) {
    if (!this.chatService?.isReady()) {
      throw new HttpException('Service not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const manager = this.chatService.getManager();
    return manager.getMessages(sessionId);
  }

  @Post('sessions/:id/messages')
  async sendMessage(@Param('id') sessionId: string, @Body() body: { content: string }) {
    if (!this.chatService?.isReady()) {
      throw new HttpException('Service not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const result = await this.chatService.handleMessage(sessionId, body.content);
    return { success: true, ...result };
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') sessionId: string) {
    if (!this.chatService?.isReady()) {
      throw new HttpException('Service not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const manager = this.chatService.getManager();
    await manager.deleteSession(sessionId);
    return { success: true };
  }

  @Get('health')
  health() {
    console.log('[ChatController] health check, chatService:', !!this.chatService);
    return {
      status: this.chatService?.isReady?.() ? 'ready' : 'not_configured',
    };
  }
}
