import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RecordingsService } from './recordings.service.js';
import { CreateRecordingDto } from './dto/create-recording.dto.js';

@Controller('recordings')
@UseGuards(JwtAuthGuard)
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname) || '.webm';
          callback(null, `recording-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024 * 1024, // 10 GB max
      },
    }),
  )
  async uploadRecording(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateRecordingDto,
  ) {
    if (!file) {
      throw new BadRequestException('No recording file provided');
    }
    return this.recordingsService.create(user.id, file, dto);
  }

  @Get('workspace/:workspaceId')
  async getWorkspaceRecordings(
    @CurrentUser() user: any,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.recordingsService.findByWorkspace(workspaceId, user.id);
  }

  @Get(':id')
  async getRecording(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.recordingsService.findById(id, user.id);
  }

  @Delete(':id')
  async deleteRecording(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.recordingsService.delete(id, user.id);
  }
}
