import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';
import { UpdateChannelDto } from './dto/update-channel.dto.js';
import { MemberRole } from '@prisma/client';

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

    // If specific initial memberIds were selected, add them
    const canAssignMembers =
      membership.role === MemberRole.OWNER ||
      membership.role === MemberRole.ADMIN ||
      membership.role === MemberRole.MANAGER ||
      membership.role === MemberRole.TEAM_LEAD;

    if (dto.memberIds && dto.memberIds.length > 0 && canAssignMembers) {
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

    // Verify caller is member of workspace and has authority
    const callerMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId: currentUserId,
        },
      },
    });

    // Channel creator, Workspace Owner, Admin, Manager, or Team Lead can add members
    const isCreator = channel.createdById === currentUserId;
    const isOwner = callerMember?.role === MemberRole.OWNER;
    const hasRoleAuthority =
      callerMember?.role === MemberRole.ADMIN ||
      callerMember?.role === MemberRole.MANAGER ||
      callerMember?.role === MemberRole.TEAM_LEAD;

    if (!callerMember || (!isCreator && !isOwner && !hasRoleAuthority)) {
      throw new ForbiddenException('Only channel creators, Workspace Owners, Admins, Managers, and Team Leads can add people to channels');
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

  async update(
    userId: string,
    channelId: string,
    dto: UpdateChannelDto,
  ) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        workspace: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
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

    // Authority: Channel creator, Workspace Owner, Admin, Manager, or Team Lead
    const isCreator = channel.createdById === userId;
    const isOwner = member.role === MemberRole.OWNER || channel.workspace.ownerId === userId;
    const isElevated =
      member.role === MemberRole.ADMIN ||
      member.role === MemberRole.MANAGER ||
      member.role === MemberRole.TEAM_LEAD;

    if (!isCreator && !isOwner && !isElevated) {
      throw new ForbiddenException('You do not have permission to edit this channel. Only creator, Admin, Manager, or Team Lead can edit.');
    }

    let formattedName = channel.name;
    if (dto.name) {
      formattedName = dto.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');

      if (formattedName !== channel.name) {
        const existing = await this.prisma.channel.findUnique({
          where: {
            workspaceId_name: {
              workspaceId: channel.workspaceId,
              name: formattedName,
            },
          },
        });
        if (existing) {
          throw new ConflictException(`Channel #${formattedName} already exists in this workspace`);
        }
      }
    }

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        name: formattedName,
        topic: dto.topic !== undefined ? dto.topic : channel.topic,
        isPrivate: dto.isPrivate !== undefined ? dto.isPrivate : channel.isPrivate,
      },
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

    return updated;
  }

  async delete(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        workspace: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
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

    // Channel creator, or Workspace Owner, or Admin can delete
    const isCreator = channel.createdById === userId;
    const isOwner = member.role === MemberRole.OWNER || channel.workspace.ownerId === userId;
    const isAdmin = member.role === MemberRole.ADMIN;

    if (!isCreator && !isOwner && !isAdmin) {
      throw new ForbiddenException('Only the channel creator, Workspace Owner, or Admins can delete this channel');
    }

    await this.prisma.channel.delete({
      where: { id: channelId },
    });

    return {
      message: `Channel #${channel.name} was successfully deleted`,
      deletedChannelId: channelId,
      workspaceId: channel.workspaceId,
    };
  }
}
