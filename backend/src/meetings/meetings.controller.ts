import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MeetingsService } from './meetings.service.js';
import { CreateMeetingDto } from './dto/create-meeting.dto.js';
import { UpdateMeetingDto } from './dto/update-meeting.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get('workspaces/:workspaceId/meetings')
  async findAll(@Request() req: any, @Param('workspaceId') workspaceId: string) {
    return this.meetingsService.findAll(req.user.id, workspaceId);
  }

  @Get('meetings/workspace/:workspaceId')
  async findAllAlt(@Request() req: any, @Param('workspaceId') workspaceId: string) {
    return this.meetingsService.findAll(req.user.id, workspaceId);
  }

  @Post('workspaces/:workspaceId/meetings')
  async create(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.meetingsService.create(req.user.id, workspaceId, dto);
  }

  @Post('meetings')
  async createAlt(
    @Request() req: any,
    @Body() dto: CreateMeetingDto,
  ) {
    const workspaceId = dto.workspaceId;
    if (!workspaceId) {
      throw new Error('workspaceId is required in body');
    }
    return this.meetingsService.create(req.user.id, workspaceId, dto);
  }

  @Get('meetings/:id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.meetingsService.findOne(req.user.id, id);
  }

  @Patch('meetings/:id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetingsService.update(req.user.id, id, dto);
  }

  @Delete('meetings/:id')
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.meetingsService.delete(req.user.id, id);
  }

  @Post('meetings/:id/respond')
  async respond(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: 'ACCEPTED' | 'DECLINED',
  ) {
    return this.meetingsService.respond(req.user.id, id, status);
  }
}
