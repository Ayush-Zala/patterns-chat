import { Module, forwardRef } from '@nestjs/common';
import { MailController } from './mail.controller.js';
import { MailService } from './mail.service.js';
import { PrismaService } from '../common/prisma.service.js';
import { MessagesModule } from '../messages/messages.module.js';

@Module({
  imports: [forwardRef(() => MessagesModule)],
  controllers: [MailController],
  providers: [MailService, PrismaService],
  exports: [MailService],
})
export class MailModule {}

