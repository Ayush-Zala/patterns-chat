import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { PresenceStatus } from '@prisma/client';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(workspaceId: string, currentUserId: string, recipientId: string) {
    if (currentUserId === recipientId) {
      throw new BadRequestException('Cannot start a direct message with yourself');
    }

    // Verify both users are members of the workspace
    const [memberOne, memberTwo] = await Promise.all([
      this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: currentUserId } },
      }),
      this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: recipientId } },
      }),
    ]);

    if (!memberOne || !memberTwo) {
      throw new ForbiddenException('Both users must belong to this workspace');
    }

    // Canonical ordering so conversation is unique regardless of who clicked first
    const [userOneId, userTwoId] =
      currentUserId < recipientId
        ? [currentUserId, recipientId]
        : [recipientId, currentUserId];

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        workspaceId_userOneId_userTwoId: {
          workspaceId,
          userOneId,
          userTwoId,
        },
      },
      include: {
        userOne: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
            presence: true,
          },
        },
        userTwo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
            presence: true,
          },
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          workspaceId,
          userOneId,
          userTwoId,
        },
        include: {
          userOne: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              status: true,
              presence: true,
            },
          },
          userTwo: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              status: true,
              presence: true,
            },
          },
        },
      });
    }

    return conversation;
  }

  async getMessages(conversationId: string, currentUserId: string, limit = 100) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.userOneId !== currentUserId &&
      conversation.userTwoId !== currentUserId
    ) {
      throw new ForbiddenException('Access denied to this private conversation');
    }

    return this.prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
            presence: true,
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

  async createMessage(
    conversationId: string,
    currentUserId: string,
    content?: string,
    attachments?: { fileName: string; fileUrl?: string; url?: string; fileType: string; fileSize: number }[],
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.userOneId !== currentUserId &&
      conversation.userTwoId !== currentUserId
    ) {
      throw new ForbiddenException('Access denied to this private conversation');
    }

    const text = (content || '').trim();
    if (!text && (!attachments || attachments.length === 0)) {
      throw new BadRequestException('Direct message must have text content or attachments');
    }

    const recipientId =
      conversation.userOneId === currentUserId
        ? conversation.userTwoId
        : conversation.userOneId;

    const message = await this.prisma.directMessage.create({
      data: {
        conversationId,
        userId: currentUserId,
        content: text,
        attachments:
          attachments && attachments.length > 0
            ? {
                create: attachments.map((att: any) => ({
                  fileName: att.fileName,
                  fileUrl: att.fileUrl || att.url || '',
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
            presence: true,
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
      message,
      workspaceId: conversation.workspaceId,
      recipientId,
    };
  }

  async togglePin(userId: string, directMessageId: string) {
    const dm = await this.prisma.directMessage.findUnique({
      where: { id: directMessageId },
      include: { conversation: true },
    });

    if (!dm) {
      throw new NotFoundException('Direct message not found');
    }

    if (
      dm.conversation.userOneId !== userId &&
      dm.conversation.userTwoId !== userId
    ) {
      throw new ForbiddenException('Access denied to this private message');
    }

    const nextIsPinned = !dm.isPinned;

    const updated = await this.prisma.directMessage.update({
      where: { id: directMessageId },
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
            presence: true,
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

    const recipientId =
      dm.conversation.userOneId === userId
        ? dm.conversation.userTwoId
        : dm.conversation.userOneId;

    return {
      message: updated,
      conversationId: dm.conversationId,
      workspaceId: dm.conversation.workspaceId,
      isPinned: nextIsPinned,
      authorId: dm.userId,
      recipientId,
    };
  }

  async getPinnedMessages(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.userOneId !== userId &&
      conversation.userTwoId !== userId
    ) {
      throw new ForbiddenException('Access denied to this private conversation');
    }

    return this.prisma.directMessage.findMany({
      where: {
        conversationId,
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
            presence: true,
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

  async toggleReaction(userId: string, directMessageId: string, emoji: string) {
    const dm = await this.prisma.directMessage.findUnique({
      where: { id: directMessageId },
      include: { conversation: true },
    });

    if (!dm) {
      throw new NotFoundException('Direct message not found');
    }

    if (
      dm.conversation.userOneId !== userId &&
      dm.conversation.userTwoId !== userId
    ) {
      throw new ForbiddenException('Access denied to this private message');
    }

    const existing = await this.prisma.directMessageReaction.findUnique({
      where: {
        directMessageId_userId_emoji: {
          directMessageId,
          userId,
          emoji,
        },
      },
    });

    let added = false;
    if (existing) {
      await this.prisma.directMessageReaction.delete({
        where: { id: existing.id },
      });
    } else {
      await this.prisma.directMessageReaction.create({
        data: {
          directMessageId,
          userId,
          emoji,
        },
      });
      added = true;
    }

    const allReactions = await this.prisma.directMessageReaction.findMany({
      where: { directMessageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const recipientId =
      dm.conversation.userOneId === userId
        ? dm.conversation.userTwoId
        : dm.conversation.userOneId;

    return {
      directMessageId,
      conversationId: dm.conversationId,
      workspaceId: dm.conversation.workspaceId,
      authorId: dm.userId,
      recipientId,
      messageContent: dm.content,
      reactions: allReactions,
      added,
    };
  }

  async updatePresence(userId: string, presence: PresenceStatus) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { presence },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        presence: true,
        status: true,
      },
    });
  }

  async updateDirectMessage(userId: string, messageId: string, content: string) {
    const dm = await this.prisma.directMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: true,
      },
    });

    if (!dm) {
      throw new NotFoundException('Direct message not found');
    }

    if (dm.userId !== userId) {
      throw new ForbiddenException('You can only edit your own direct messages');
    }

    const updated = await this.prisma.directMessage.update({
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
            presence: true,
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
      conversationId: dm.conversationId,
    };
  }

  async deleteDirectMessage(userId: string, messageId: string) {
    const dm = await this.prisma.directMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: true,
      },
    });

    if (!dm) {
      throw new NotFoundException('Direct message not found');
    }

    if (dm.userId !== userId) {
      throw new ForbiddenException('You can only delete your own direct messages');
    }

    await this.prisma.directMessage.delete({
      where: { id: messageId },
    });

    return {
      messageId,
      conversationId: dm.conversationId,
      success: true,
    };
  }
}
