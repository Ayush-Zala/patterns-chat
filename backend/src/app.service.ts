import { Injectable } from '@nestjs/common';
import { PrismaService } from './common/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth() {
    return {
      status: 'ok',
      message: 'TeamFlow API is running',
    };
  }
}
