import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchWorkspace(
    userId: string,
    workspaceId: string,
    query: string,
    filter: 'all' | 'messages' | 'files' | 'channels' | 'people' = 'all',
    inChannel?: string,
    fromUser?: string,
  ) {
    const q = (query || '').trim();

    // Verify user belongs to workspace
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    const results: {
      messages: any[];
      files: any[];
      channels: any[];
      people: any[];
      total: number;
    } = {
      messages: [],
      files: [],
      channels: [],
      people: [],
      total: 0,
    };

    // If query is empty, return empty results
    if (!q) {
      return results;
    }

    // 1. Search Messages
    if (filter === 'all' || filter === 'messages') {
      const channelMessagesWhere: any = {
        channel: {
          workspaceId,
          ...(inChannel ? { id: inChannel } : {}),
        },
        content: {
          contains: q,
          mode: 'insensitive',
        },
      };

      if (fromUser) {
        channelMessagesWhere.userId = fromUser;
      }

      const channelMessages = await this.prisma.message.findMany({
        where: channelMessagesWhere,
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          channel: {
            select: {
              id: true,
              name: true,
              isPrivate: true,
            },
          },
          attachments: true,
          reactions: true,
        },
      });

      // Also search DMs the user participates in
      const directMessagesWhere: any = {
        conversation: {
          workspaceId,
          OR: [{ userOneId: userId }, { userTwoId: userId }],
        },
        content: {
          contains: q,
          mode: 'insensitive',
        },
      };

      if (fromUser) {
        directMessagesWhere.userId = fromUser;
      }

      const directMessages = await this.prisma.directMessage.findMany({
        where: directMessagesWhere,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          conversation: {
            include: {
              userOne: {
                select: { id: true, name: true, avatarUrl: true },
              },
              userTwo: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          },
          attachments: true,
          reactions: true,
        },
      });

      results.messages = [
        ...channelMessages.map((m) => ({ ...m, contextType: 'channel' })),
        ...directMessages.map((dm) => ({ ...dm, contextType: 'direct' })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // 2. Search Files / Attachments
    if (filter === 'all' || filter === 'files') {
      const files = await this.prisma.attachment.findMany({
        where: {
          fileName: {
            contains: q,
            mode: 'insensitive',
          },
          OR: [
            {
              message: {
                channel: {
                  workspaceId,
                },
              },
            },
            {
              directMessage: {
                conversation: {
                  workspaceId,
                  OR: [{ userOneId: userId }, { userTwoId: userId }],
                },
              },
            },
          ],
        },
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          message: {
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true },
              },
              channel: {
                select: { id: true, name: true },
              },
            },
          },
          directMessage: {
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          },
        },
      });

      results.files = files;
    }

    // 3. Search Channels
    if (filter === 'all' || filter === 'channels') {
      const channels = await this.prisma.channel.findMany({
        where: {
          workspaceId,
          OR: [
            {
              name: {
                contains: q,
                mode: 'insensitive',
              },
            },
            {
              topic: {
                contains: q,
                mode: 'insensitive',
              },
            },
          ],
        },
        take: 20,
        include: {
          _count: {
            select: { messages: true },
          },
        },
      });

      results.channels = channels;
    }

    // 4. Search People / Workspace Members
    if (filter === 'all' || filter === 'people') {
      const members = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          user: {
            OR: [
              {
                name: {
                  contains: q,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: q,
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
        take: 20,
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
        },
      });

      results.people = members.map((m) => ({
        ...m.user,
        role: m.role,
        joinedAt: m.joinedAt,
      }));
    }

    results.total =
      results.messages.length +
      results.files.length +
      results.channels.length +
      results.people.length;

    return results;
  }
}
