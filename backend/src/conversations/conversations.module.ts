import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';
import { ConversationsController } from './conversations.controller.js';
import { PrismaService } from '../common/prisma.service.js';
import { MessagesModule } from '../messages/messages.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuthModule, MessagesModule, NotificationsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, PrismaService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
