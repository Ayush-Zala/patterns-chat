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
import { MessagesService } from './messages.service.js';
import { MessagesGateway } from './messages.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../common/prisma.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('channels/:channelId/messages')
  async getMessages(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    return this.messagesService.findByChannel(user.id, channelId, parsedLimit);
  }

  @Post('channels/:channelId/messages')
  async createMessage(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
    @Body() dto: CreateMessageDto,
  ) {
    const message = await this.messagesService.create(user.id, channelId, dto);
    const room = `channel:${channelId}`;

    if (dto.parentId) {
      this.messagesGateway.server.to(room).emit('new_thread_reply', {
        parentId: dto.parentId,
        reply: message,
      });

      // Notify thread parent author
      try {
        const parentMsg = await this.prisma.message.findUnique({
          where: { id: dto.parentId },
          include: { channel: true },
        });

        if (parentMsg && parentMsg.userId !== user.id) {
          const notif = await this.notificationsService.create({
            workspaceId: parentMsg.channel.workspaceId,
            userId: parentMsg.userId,
            actorId: user.id,
            type: 'THREAD_REPLY',
            title: `${message.user.name} replied in a thread`,
            body: message.content || 'Sent an attachment',
            channelId,
            messageId: message.id,
          });

          if (notif) {
            this.messagesGateway.server
              .to(`user:${parentMsg.userId}`)
              .emit('new_notification', notif);
          }
        }
      } catch (err) {
        // Notification failure should not break messaging
      }
    } else {
      this.messagesGateway.server.to(room).emit('new_message', message);
      if ((message as any).channel?.workspaceId) {
        this.messagesGateway.server
          .to(`workspace:${(message as any).channel.workspaceId}`)
          .emit('workspace_channel_message', {
            channelId,
            message,
          });
      }
    }

    // Check for @mentions in message content
    if (message.content && message.content.includes('@')) {
      try {
        const channel = await this.prisma.channel.findUnique({
          where: { id: channelId },
          include: {
            workspace: {
              include: {
                members: {
                  include: {
                    user: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (channel?.workspace?.members) {
          const mentionedUsers = channel.workspace.members.filter(
            (m) =>
              m.userId !== user.id &&
              message.content.toLowerCase().includes(`@${m.user.name.toLowerCase()}`),
          );

          for (const target of mentionedUsers) {
            const notif = await this.notificationsService.create({
              workspaceId: channel.workspaceId,
              userId: target.userId,
              actorId: user.id,
              type: 'MENTION',
              title: `${message.user.name} mentioned you in #${channel.name}`,
              body: message.content,
              channelId,
              messageId: message.id,
            });

            if (notif) {
              this.messagesGateway.server
                .to(`user:${target.userId}`)
                .emit('new_notification', notif);
            }
          }
        }
      } catch (err) {
        // Mentions failure should not break messaging
      }
    }

    return message;
  }

  @Get('messages/:messageId/thread')
  async getThread(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.getThread(user.id, messageId);
  }

  @Post('messages/:messageId/reactions')
  async toggleReaction(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body('emoji') emoji: string,
  ) {
    const result = await this.messagesService.toggleReaction(user.id, messageId, emoji);
    this.messagesGateway.server
      .to(`channel:${result.channelId}`)
      .emit('reaction_updated', {
        messageId: result.messageId,
        reactions: result.reactions,
      });

    // Send notification to author if reaction added
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
          title: `${reactor?.name || 'Someone'} reacted with ${emoji} to your message`,
          body: result.messageContent || `In #${result.channelName}`,
          channelId: result.channelId,
          messageId: result.messageId,
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

  @Post('channels/:channelId/messages/:messageId/pin')
  async togglePin(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
  ) {
    const result = await this.messagesService.togglePin(user.id, messageId);

    // Broadcast pin update in real-time to channel
    this.messagesGateway.server
      .to(`channel:${channelId}`)
      .emit('message_pinned', {
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
          title: `${result.message.pinnedBy?.name || 'A team member'} pinned your message in #${result.channelName}`,
          body: result.message.content || 'Pinned an attachment',
          channelId,
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

  @Get('channels/:channelId/pins')
  async getPinnedMessages(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
  ) {
    return this.messagesService.getPinnedMessages(user.id, channelId);
  }

  @Patch('messages/:messageId')
  async updateMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body('content') content: string,
  ) {
    const updated = await this.messagesService.update(user.id, messageId, content);

    // Broadcast in real-time to channel room
    this.messagesGateway.server
      .to(`channel:${updated.channelId}`)
      .emit('message_updated', updated);

    return updated;
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
  ) {
    const result = await this.messagesService.delete(user.id, messageId);

    // Broadcast in real-time to channel room
    this.messagesGateway.server
      .to(`channel:${result.channelId}`)
      .emit('message_deleted', result);

    return result;
  }
}
