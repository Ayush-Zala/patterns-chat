import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, workspaceId: string, dto: CreateChannelDto) {
    // Verify user is in workspace
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    const formattedName = dto.name.toLowerCase().trim();

    const existing = await this.prisma.channel.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name: formattedName,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Channel #${formattedName} already exists in this workspace`);
    }

    const channel = await this.prisma.channel.create({
      data: {
        name: formattedName,
        topic: dto.topic?.trim() || null,
        isPrivate: dto.isPrivate ?? false,
        workspaceId,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Creator is always added as a member of their channel
    await this.prisma.channelMember.create({
      data: {
        channelId: channel.id,
        userId,
      },
    });

    // If specific initial memberIds were selected, add them (only if caller is OWNER or ADMIN)
    if (dto.memberIds && dto.memberIds.length > 0 && (membership.role === 'OWNER' || membership.role === 'ADMIN')) {
      const validMemberIds = dto.memberIds.filter((id) => id !== userId);
      for (const targetId of validMemberIds) {
        await this.prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: channel.id, userId: targetId } },
          create: { channelId: channel.id, userId: targetId },
          update: {},
        });
      }
    }

    // Public channels auto-seed all workspace members
    if (!dto.isPrivate) {
      const allMembers = await this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true },
      });
      for (const m of allMembers) {
        await this.prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: channel.id, userId: m.userId } },
          create: { channelId: channel.id, userId: m.userId },
          update: {},
        });
      }
    }

    return this.findById(userId, channel.id);
  }

  async findAllForWorkspace(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    let channels = await this.prisma.channel.findMany({
      where: {
        workspaceId,
        OR: [
          { isPrivate: false },
          { members: { some: { userId } } },
          { createdById: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { messages: true, members: true },
        },
        members: {
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
        },
      },
    });

    // If workspace has no channels, automatically seed default Slack channels (#general and #random)
    if (channels.length === 0) {
      const general = await this.prisma.channel.create({
        data: {
          name: 'general',
          topic: 'Company-wide announcements and team discussions',
          isPrivate: false,
          workspaceId,
          createdById: userId,
        },
      });

      const random = await this.prisma.channel.create({
        data: {
          name: 'random',
          topic: 'Non-work banter, water cooler chats, and fun links',
          isPrivate: false,
          workspaceId,
          createdById: userId,
        },
      });

      // Add user to seeded channels
      await this.prisma.channelMember.createMany({
        data: [
          { channelId: general.id, userId },
          { channelId: random.id, userId },
        ],
      });

      channels = await this.prisma.channel.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
        include: {
          _count: {
            select: { messages: true, members: true },
          },
          members: {
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
          },
        },
      });
    }

    return channels;
  }

  async findById(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { messages: true, members: true },
        },
        members: {
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
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Verify user belongs to workspace
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspace.id,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this channel');
    }

    // If channel is private, verify user is a member of this channel
    if (channel.isPrivate) {
      const isChannelMember = channel.members.some((m) => m.userId === userId) || channel.createdById === userId;
      if (!isChannelMember) {
        throw new ForbiddenException('This channel is private. You must be added by a channel member.');
      }
    }

    return channel;
  }

  async getMembers(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        workspace: {
          include: {
            members: {
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
            },
          },
        },
        members: {
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
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (!channel.isPrivate) {
      // For public channels, all workspace members belong to the channel
      return channel.workspace.members.map((m) => ({
        id: m.id,
        joinedAt: m.joinedAt,
        user: m.user,
      }));
    }

    return channel.members.map((m) => ({
      id: m.id,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  async addMember(channelId: string, currentUserId: string, targetUserId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Verify caller is OWNER or ADMIN of the workspace
    const callerMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId: currentUserId,
        },
      },
    });

    if (!callerMember || (callerMember.role !== 'OWNER' && callerMember.role !== 'ADMIN')) {
      throw new ForbiddenException('Only workspace owners can add people to channels');
    }

    const workspaceMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId: targetUserId,
        },
      },
    });

    if (!workspaceMember) {
      throw new ForbiddenException('User must belong to the workspace before joining this channel');
    }

    const member = await this.prisma.channelMember.upsert({
      where: {
        channelId_userId: {
          channelId,
          userId: targetUserId,
        },
      },
      create: {
        channelId,
        userId: targetUserId,
      },
      update: {},
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

    return {
      message: `${member.user.name} was added to #${channel.name}`,
      member,
    };
  }

  async removeMember(channelId: string, currentUserId: string, targetUserId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Verify caller is OWNER or ADMIN of the workspace (or user leaving themselves)
    const callerMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId: currentUserId,
        },
      },
    });

    const isSelf = currentUserId === targetUserId;
    const isOwnerOrAdmin =
      callerMember && (callerMember.role === 'OWNER' || callerMember.role === 'ADMIN');

    if (!isSelf && !isOwnerOrAdmin) {
      throw new ForbiddenException('Only workspace owners can remove members from channels');
    }

    await this.prisma.channelMember.deleteMany({
      where: {
        channelId,
        userId: targetUserId,
      },
    });

    return {
      message: `User removed from #${channel.name}`,
    };
  }
}
