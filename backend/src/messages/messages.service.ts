import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, channelId: string, dto: CreateMessageDto) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { workspaceId: true },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Verify membership in workspace
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    const content = (dto.content || '').trim();
    if (!content && (!dto.attachments || dto.attachments.length === 0)) {
      throw new BadRequestException('Message must have text content or attachments');
    }

    const message = await this.prisma.message.create({
      data: {
        content,
        channelId,
        userId,
        parentId: dto.parentId || null,
        attachments:
          dto.attachments && dto.attachments.length > 0
            ? {
                create: dto.attachments.map((att) => ({
                  fileName: att.fileName,
                  fileUrl: att.fileUrl || (att as any).url || '',
                  fileType: att.fileType,
                  fileSize: att.fileSize,
                })),
              }
            : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        pinnedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        attachments: true,
        _count: {
          select: { replies: true },
        },
        replies: {
          select: {
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            workspaceId: true,
          },
        },
      },
    });

    return message;
  }

  async findByChannel(userId: string, channelId: string, limit = 100) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { workspaceId: true },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
        parentId: null, // Top-level messages (replies shown inside threads)
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        pinnedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        attachments: true,
        _count: {
          select: { replies: true },
        },
        replies: {
          select: {
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return messages;
  }

  async getThread(userId: string, messageId: string) {
    const parent = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            workspaceId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        pinnedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        attachments: true,
        _count: {
          select: { replies: true },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException('Message not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: parent.channel.workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    const replies = await this.prisma.message.findMany({
      where: { parentId: messageId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        pinnedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      parent,
      replies,
    };
  }

  async togglePin(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: message.channel.workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    const nextIsPinned = !message.isPinned;

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned: nextIsPinned,
        pinnedAt: nextIsPinned ? new Date() : null,
        pinnedById: nextIsPinned ? userId : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        pinnedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      message: updated,
      channelId: message.channelId,
      channelName: message.channel.name,
      workspaceId: message.channel.workspaceId,
      isPinned: nextIsPinned,
      authorId: message.userId,
    };
  }

  async getPinnedMessages(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { workspaceId: true },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    return this.prisma.message.findMany({
      where: {
        channelId,
        isPinned: true,
      },
      orderBy: { pinnedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        pinnedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async toggleReaction(userId: string, messageId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const existing = await this.prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    let added = false;
    if (existing) {
      await this.prisma.reaction.delete({
        where: { id: existing.id },
      });
    } else {
      await this.prisma.reaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
      });
      added = true;
    }

    // Return all current reactions for this message
    const allReactions = await this.prisma.reaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      messageId,
      channelId: message.channelId,
      channelName: message.channel.name,
      workspaceId: message.channel.workspaceId,
      authorId: message.userId,
      messageContent: message.content,
      reactions: allReactions,
      added,
    };
  }

  async update(userId: string, messageId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          select: {
            workspaceId: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: message.channel.workspaceId,
          userId,
        },
      },
    });

    const isAuthor = message.userId === userId;
    const isOwnerOrAdmin = member && (member.role === 'OWNER' || member.role === 'ADMIN');

    if (!isAuthor && !isOwnerOrAdmin) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        isEdited: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        pinnedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        attachments: true,
        _count: {
          select: { replies: true },
        },
        replies: {
          select: {
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return updated;
  }

  async delete(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          select: {
            workspaceId: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: message.channel.workspaceId,
          userId,
        },
      },
    });

    const isAuthor = message.userId === userId;
    const isOwnerOrAdmin = member && (member.role === 'OWNER' || member.role === 'ADMIN');

    if (!isAuthor && !isOwnerOrAdmin) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });

    return {
      messageId,
      channelId: message.channelId,
      parentId: message.parentId,
      success: true,
    };
  }
}
