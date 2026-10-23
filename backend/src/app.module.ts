import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './common/prisma.service.js';
import { AuthModule } from './auth/auth.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { SearchModule } from './search/search.module.js';
import { RecordingsModule } from './recordings/recordings.module.js';
import { MeetingsModule } from './meetings/meetings.module.js';
import { MailModule } from './mail/mail.module.js';
import configuration from './config/configuration.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    AuthModule,
    WorkspacesModule,
    ChannelsModule,
    MessagesModule,
    ConversationsModule,
    UploadsModule,
    NotificationsModule,
    SearchModule,
    RecordingsModule,
    MeetingsModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
