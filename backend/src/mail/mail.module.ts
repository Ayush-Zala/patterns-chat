import { Module } from '@nestjs/common';
import { MailController } from './mail.controller.js';
import { MailService } from './mail.service.js';
import { PrismaService } from '../common/prisma.service.js';

@Module({
  controllers: [MailController],
  providers: [MailService, PrismaService],
  exports: [MailService],
})
export class MailModule {}
