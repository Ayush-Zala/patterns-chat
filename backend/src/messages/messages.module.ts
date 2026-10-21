import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { MessagesController } from './messages.controller.js';
import { MessagesGateway } from './messages.gateway.js';
import { PrismaService } from '../common/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuthModule, JwtModule, NotificationsModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway, PrismaService],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
