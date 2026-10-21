import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service.js';
import { ChannelsController } from './channels.controller.js';
import { PrismaService } from '../common/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, PrismaService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
