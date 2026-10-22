import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { CreateRecordingDto } from './dto/create-recording.dto.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    file: Express.Multer.File,
    dto: CreateRecordingDto,
  ) {
    const fileUrl = `/uploads/${file.filename}`;
    const fileSize = file.size;
    const fileType = file.mimetype || 'video/webm';
    const duration = dto.duration ? Math.round(Number(dto.duration)) : 0;
    const isVideo = String(dto.isVideo) === 'true';

    // Verify workspace access
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: dto.workspaceId,
        userId,
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    const recording = await this.prisma.callRecording.create({
      data: {
        fileName: file.originalname,
        fileUrl,
        fileSize,
        fileType,
        duration,
        isVideo,
        workspaceId: dto.workspaceId,
        channelId: dto.channelId || null,
        conversationId: dto.conversationId || null,
        peerId: dto.peerId || null,
        recordedById: userId,
      },
      include: {
        recordedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    this.logger.log(`📹 Saved call recording: ${recording.id} (${recording.fileName}, duration: ${duration}s)`);

    // If recorded in a channel, automatically post an attachment message so it appears in the chat
    if (dto.channelId) {
      try {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        const content = `📞 **${isVideo ? 'Video' : 'Audio'} Call Recording** (${durStr})`;

        const message = await this.prisma.message.create({
          data: {
            content,
            channelId: dto.channelId,
            userId,
            attachments: {
              create: {
                fileName: file.originalname,
                fileUrl,
                fileType,
                fileSize,
              },
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
            attachments: true,
          },
        });
        this.logger.log(`💬 Auto-posted recording message to channel ${dto.channelId}: ${message.id}`);
      } catch (err) {
        this.logger.warn('Could not auto-post channel message for recording', err);
      }
    } else if (dto.conversationId) {
      try {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        const content = `📞 **${isVideo ? 'Video' : 'Audio'} Call Recording** (${durStr})`;

        await this.prisma.directMessage.create({
          data: {
            content,
            conversationId: dto.conversationId,
            userId,
            attachments: {
              create: {
                fileName: file.originalname,
                fileUrl,
                fileType,
                fileSize,
              },
            },
          },
        });
        this.logger.log(`💬 Auto-posted recording direct message to conversation ${dto.conversationId}`);
      } catch (err) {
        this.logger.warn('Could not auto-post DM for recording', err);
      }
    }

    return recording;
  }

  async findByWorkspace(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!member) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.callRecording.findMany({
      where: { workspaceId },
      include: {
        recordedBy: {
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string) {
    const recording = await this.prisma.callRecording.findUnique({
      where: { id },
      include: {
        recordedBy: {
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

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: recording.workspaceId, userId },
    });

    if (!member) {
      throw new ForbiddenException('Access denied');
    }

    return recording;
  }

  async delete(id: string, userId: string) {
    const recording = await this.prisma.callRecording.findUnique({
      where: { id },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    if (recording.recordedById !== userId) {
      // Check if workspace owner/admin
      const member = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId: recording.workspaceId, userId },
      });
      if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
        throw new ForbiddenException('You cannot delete this recording');
      }
    }

    // Attempt file unlink
    try {
      const filename = recording.fileUrl.replace('/uploads/', '');
      const filePath = join(process.cwd(), 'uploads', filename);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (e) {
      this.logger.warn('Could not delete recording file from disk', e);
    }

    await this.prisma.callRecording.delete({
      where: { id },
    });

    return { success: true, message: 'Recording deleted successfully' };
  }
}
