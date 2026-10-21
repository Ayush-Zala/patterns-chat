import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ChannelsService } from './channels.service.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post('workspaces/:workspaceId/channels')
  async create(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channelsService.create(user.id, workspaceId, dto);
  }

  @Get('workspaces/:workspaceId/channels')
  async findAll(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.channelsService.findAllForWorkspace(user.id, workspaceId);
  }

  @Get('channels/:channelId')
  async findOne(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.findById(user.id, channelId);
  }

  @Get('channels/:channelId/members')
  async getMembers(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.getMembers(channelId, user.id);
  }

  @Post('channels/:channelId/members')
  async addMember(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
    @Body('userId') targetUserId: string,
  ) {
    return this.channelsService.addMember(channelId, user.id, targetUserId);
  }

  @Delete('channels/:channelId/members/:userId')
  async removeMember(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.channelsService.removeMember(channelId, user.id, targetUserId);
  }
}
