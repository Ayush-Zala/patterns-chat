import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../common/prisma.service.js';
import {
  CreateDirectMessageDto,
  FindOrCreateConversationDto,
} from './dto/create-direct-message.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { MessagesGateway } from '../messages/messages.gateway.js';
import { PresenceStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller()
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesGateway: MessagesGateway,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('workspaces/:workspaceId/conversations')
  async findOrCreate(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
    @Body() dto: FindOrCreateConversationDto,
  ) {
    return this.conversationsService.findOrCreate(
      workspaceId,
      user.id,
      dto.recipientId,
    );
  }

  @Get('conversations/:conversationId/messages')
  async getMessages(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    return this.conversationsService.getMessages(
      conversationId,
      user.id,
      parsedLimit,
    );
  }

  @Post('conversations/:conversationId/messages')
  async createMessage(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateDirectMessageDto,
  ) {
    const { message, workspaceId, recipientId } =
      await this.conversationsService.createMessage(
        conversationId,
        user.id,
        dto.content,
        dto.attachments,
      );

    // Broadcast in real-time to both conversation participants
    this.messagesGateway.server
      .to(`conversation:${conversationId}`)
      .emit('new_direct_message', message);

    if (recipientId) {
      this.messagesGateway.server
        .to(`user:${recipientId}`)
        .emit('new_direct_message', message);
    }

    // Notify recipient if they aren't the sender
    if (recipientId && recipientId !== user.id) {
      try {
        const notif = await this.notificationsService.create({
          workspaceId,
          userId: recipientId,
          actorId: user.id,
          type: 'DIRECT_MESSAGE',
          title: `Direct message from ${message.user.name}`,
          body: message.content || 'Sent an attachment',
          conversationId,
          messageId: message.id,
        });

        if (notif) {
          this.messagesGateway.server
            .to(`user:${recipientId}`)
            .emit('new_notification', notif);
        }
      } catch (err) {
        // Notification failure should not break messaging
      }
    }

    return message;
  }

  @Post('conversations/messages/:messageId/reactions')
  async toggleReaction(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body('emoji') emoji: string,
  ) {
    const result = await this.conversationsService.toggleReaction(
      user.id,
      messageId,
      emoji,
    );

    this.messagesGateway.server
      .to(`conversation:${result.conversationId}`)
      .emit('direct_reaction_updated', {
        directMessageId: result.directMessageId,
        reactions: result.reactions,
      });

    // Notify DM author if reaction was added
    if (result.added && result.authorId && result.authorId !== user.id) {
      try {
        const reactor = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { name: true },
        });

        const notif = await this.notificationsService.create({
          workspaceId: result.workspaceId,
          userId: result.authorId,
          actorId: user.id,
          type: 'REACTION',
          title: `${reactor?.name || 'Someone'} reacted with ${emoji} to your direct message`,
          body: result.messageContent || 'In Direct Messages',
          conversationId: result.conversationId,
          messageId: result.directMessageId,
        });

        if (notif) {
          this.messagesGateway.server
            .to(`user:${result.authorId}`)
            .emit('new_notification', notif);
        }
      } catch (err) {
        // Continue silently
      }
    }

    return result;
  }

  @Post('conversations/:conversationId/messages/:messageId/pin')
  async togglePin(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    const result = await this.conversationsService.togglePin(user.id, messageId);

    // Broadcast pin update in real-time
    this.messagesGateway.server
      .to(`conversation:${conversationId}`)
      .emit('direct_message_pinned', {
        messageId: result.message.id,
        isPinned: result.isPinned,
        message: result.message,
      });

    // Notify author if pinned
    if (result.isPinned && result.authorId !== user.id) {
      try {
        const notif = await this.notificationsService.create({
          workspaceId: result.workspaceId,
          userId: result.authorId,
          actorId: user.id,
          type: 'PIN',
          title: `${result.message.pinnedBy?.name || 'A user'} pinned your message in Direct Messages`,
          body: result.message.content || 'Pinned an attachment',
          conversationId,
          messageId,
        });

        if (notif) {
          this.messagesGateway.server
            .to(`user:${result.authorId}`)
            .emit('new_notification', notif);
        }
      } catch (err) {
        // Continue silently
      }
    }

    return result;
  }

  @Get('conversations/:conversationId/pins')
  async getPinnedMessages(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.getPinnedMessages(user.id, conversationId);
  }

  @Patch('users/presence')
  async updatePresence(
    @CurrentUser() user: { id: string },
    @Body('presence') presence: PresenceStatus,
  ) {
    const updated = await this.conversationsService.updatePresence(
      user.id,
      presence,
    );

    // Broadcast presence update in real-time
    this.messagesGateway.server.emit('presence_updated', updated);

    return updated;
  }

  @Patch('direct-messages/:messageId')
  async updateDirectMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body('content') content: string,
  ) {
    const { message, conversationId } =
      await this.conversationsService.updateDirectMessage(
        user.id,
        messageId,
        content,
      );

    this.messagesGateway.server
      .to(`conversation:${conversationId}`)
      .emit('direct_message_updated', message);

    return message;
  }

  @Delete('direct-messages/:messageId')
  async deleteDirectMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
  ) {
    const result = await this.conversationsService.deleteDirectMessage(
      user.id,
      messageId,
    );

    this.messagesGateway.server
      .to(`conversation:${result.conversationId}`)
      .emit('direct_message_deleted', result);

    return result;
  }
}
