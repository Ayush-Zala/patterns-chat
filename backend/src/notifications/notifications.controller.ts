import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('workspaces/:workspaceId/notifications')
  async getNotifications(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const isUnread = unreadOnly === 'true';
    return this.notificationsService.findByUser(user.id, workspaceId, isUnread);
  }

  @Patch('notifications/:id/read')
  async markAsRead(
    @CurrentUser() user: { id: string },
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(user.id, notificationId);
  }

  @Post('workspaces/:workspaceId/notifications/read-all')
  async markAllAsRead(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.notificationsService.markAllAsRead(user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/notifications/unread-count')
  async getUnreadCount(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.notificationsService.getUnreadCount(user.id, workspaceId);
  }
}
