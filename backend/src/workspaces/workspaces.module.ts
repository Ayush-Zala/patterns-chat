import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service.js';
import { WorkspacesController } from './workspaces.controller.js';
import { PrismaService } from '../common/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, PrismaService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
