import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { JoinWorkspaceDto } from './dto/join-workspace.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.create(user.id, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.workspacesService.findAllForUser(user.id);
  }

  @Post('join')
  async join(
    @CurrentUser() user: { id: string },
    @Body() dto: JoinWorkspaceDto,
  ) {
    return this.workspacesService.joinByCode(user.id, dto.joinCode);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.workspacesService.findById(id, user.id);
  }

  @Get(':id/members')
  async getMembers(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.workspacesService.getMembers(id, user.id);
  }

  @Post(':id/members')
  async addMember(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    return this.workspacesService.addMemberByEmail(user.id, id, email);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.workspacesService.removeMember(user.id, id, memberId);
  }
}
