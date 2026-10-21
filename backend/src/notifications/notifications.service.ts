import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

export interface CreateNotificationParams {
  workspaceId: string;
  userId: string;
  actorId: string;
  type: 'MENTION' | 'REACTION' | 'DIRECT_MESSAGE' | 'THREAD_REPLY' | 'PIN';
  title: string;
  body: string;
  channelId?: string;
  conversationId?: string;
  messageId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateNotificationParams) {
    // Avoid notifying yourself
    if (params.userId === params.actorId) {
      return null;
    }

    return this.prisma.notification.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        actorId: params.actorId,
        type: params.type,
        title: params.title,
        body: params.body,
        channelId: params.channelId || null,
        conversationId: params.conversationId || null,
        messageId: params.messageId || null,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async findByUser(userId: string, workspaceId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        workspaceId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Not authorized to update this notification');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async markAllAsRead(userId: string, workspaceId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        workspaceId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true };
  }

  async getUnreadCount(userId: string, workspaceId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        workspaceId,
        isRead: false,
      },
    });

    return { count };
  }
}
