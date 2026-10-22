import { Module } from '@nestjs/common';
import { RecordingsService } from './recordings.service.js';
import { RecordingsController } from './recordings.controller.js';
import { PrismaService } from '../common/prisma.service.js';

@Module({
  controllers: [RecordingsController],
  providers: [RecordingsService, PrismaService],
  exports: [RecordingsService],
})
export class RecordingsModule {}
