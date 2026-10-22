import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { CreateMeetingDto } from './dto/create-meeting.dto.js';
import { UpdateMeetingDto } from './dto/update-meeting.dto.js';
import { MemberRole } from '@prisma/client';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const isElevated =
      member.role === MemberRole.OWNER ||
      member.role === MemberRole.ADMIN ||
      member.role === MemberRole.MANAGER ||
      member.role === MemberRole.TEAM_LEAD;

    // Super Admin, Admin, Manager, and Team Lead see all meetings across the workspace
    // Regular members see meetings where they are host or participant or public channel meetings
    const whereClause: any = {
      workspaceId,
    };

    if (!isElevated) {
      whereClause.OR = [
        { hostId: userId },
        { participants: { some: { userId } } },
        { channel: { isPrivate: false } },
      ];
    }

    return this.prisma.meeting.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'asc' },
      include: {
        host: {
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
        participants: {
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

  async findOne(userId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        host: {
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
        participants: {
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

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return meeting;
  }

  async create(userId: string, workspaceId: string, dto: CreateMeetingDto) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const scheduledDate = new Date(dto.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid scheduledAt date format');
    }

    // Generate dedicated meeting link
    const meetingId = crypto.randomUUID();
    const meetingLink = `/workspace/${workspaceId}?meeting=${meetingId}`;

    const meeting = await this.prisma.meeting.create({
      data: {
        id: meetingId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        scheduledAt: scheduledDate,
        duration: dto.duration || 30,
        meetingLink,
        workspaceId,
        channelId: dto.channelId || null,
        hostId: userId,
        status: 'SCHEDULED',
      },
      include: {
        host: {
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
          },
        },
      },
    });

    // Add host as an accepted participant
    await this.prisma.meetingParticipant.create({
      data: {
        meetingId: meeting.id,
        userId,
        status: 'ACCEPTED',
      },
    });

    // Add selected invited participants
    const participantIds = dto.participantIds ? dto.participantIds.filter((id) => id !== userId) : [];
    for (const pId of participantIds) {
      await this.prisma.meetingParticipant.upsert({
        where: { meetingId_userId: { meetingId: meeting.id, userId: pId } },
        create: {
          meetingId: meeting.id,
          userId: pId,
          status: 'INVITED',
        },
        update: {},
      });

      // Send in-app notification to participant
      await this.prisma.notification.create({
        data: {
          workspaceId,
          userId: pId,
          actorId: userId,
          type: 'MEETING_INVITE',
          title: `Meeting: ${dto.title}`,
          body: `${member.user.name} scheduled "${dto.title}" for ${scheduledDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
          channelId: dto.channelId || null,
        },
      });
    }

    return this.findOne(userId, meeting.id);
  }

  async update(userId: string, meetingId: string, dto: UpdateMeetingDto) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    const isHost = meeting.hostId === userId;
    const isLeadership =
      member.role === MemberRole.OWNER ||
      member.role === MemberRole.ADMIN ||
      member.role === MemberRole.MANAGER ||
      member.role === MemberRole.TEAM_LEAD;

    if (!isHost && !isLeadership) {
      throw new ForbiddenException('You do not have permission to modify this meeting');
    }

    const updateData: any = {};
    if (dto.title) updateData.title = dto.title.trim();
    if (dto.description !== undefined) updateData.description = dto.description?.trim() || null;
    if (dto.scheduledAt) {
      const d = new Date(dto.scheduledAt);
      if (!isNaN(d.getTime())) updateData.scheduledAt = d;
    }
    if (dto.duration) updateData.duration = dto.duration;
    if (dto.channelId !== undefined) updateData.channelId = dto.channelId || null;
    if (dto.status) updateData.status = dto.status;

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: updateData,
    });

    if (dto.participantIds) {
      // Sync participants
      const validIds = dto.participantIds.filter((id) => id !== meeting.hostId);
      for (const pId of validIds) {
        await this.prisma.meetingParticipant.upsert({
          where: { meetingId_userId: { meetingId, userId: pId } },
          create: { meetingId, userId: pId, status: 'INVITED' },
          update: {},
        });
      }
    }

    return this.findOne(userId, meetingId);
  }

  async delete(userId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId,
        },
      },
    });

    const isHost = meeting.hostId === userId;
    const isOwnerOrAdmin = member?.role === MemberRole.OWNER || member?.role === MemberRole.ADMIN;

    if (!isHost && !isOwnerOrAdmin) {
      throw new ForbiddenException('Only the meeting host or workspace admins can delete this meeting');
    }

    await this.prisma.meeting.delete({
      where: { id: meetingId },
    });

    return { success: true, message: 'Meeting successfully removed', deletedMeetingId: meetingId };
  }

  async respond(userId: string, meetingId: string, status: 'ACCEPTED' | 'DECLINED') {
    const participant = await this.prisma.meetingParticipant.findUnique({
      where: {
        meetingId_userId: {
          meetingId,
          userId,
        },
      },
    });

    if (!participant) {
      await this.prisma.meetingParticipant.create({
        data: {
          meetingId,
          userId,
          status,
        },
      });
    } else {
      await this.prisma.meetingParticipant.update({
        where: {
          meetingId_userId: {
            meetingId,
            userId,
          },
        },
        data: { status },
      });
    }

    return { success: true, status };
  }
}
