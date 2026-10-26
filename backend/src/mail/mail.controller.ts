import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MailService } from './mail.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { EmailProvider } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('accounts')
  async getAccounts(@CurrentUser() user: { id: string }) {
    return this.mailService.getAccounts(user.id);
  }

  @Get('auth/google/url')
  async getGoogleAuthUrl(
    @CurrentUser() user: { id: string },
    @Query('redirectUri') redirectUri?: string,
  ) {
    return this.mailService.getGoogleAuthUrl(user.id, redirectUri);
  }

  @Post('auth/google/callback')
  async handleGoogleCallback(
    @CurrentUser() user: { id: string },
    @Body() body: { code: string; emailAddress?: string; redirectUri?: string },
  ) {
    return this.mailService.handleGoogleCallback(user.id, body.code, body.redirectUri, body.emailAddress);
  }

  @Get('auth/microsoft/url')
  async getMicrosoftAuthUrl(
    @CurrentUser() user: { id: string },
    @Query('redirectUri') redirectUri?: string,
  ) {
    return this.mailService.getMicrosoftAuthUrl(user.id, redirectUri);
  }

  @Post('auth/microsoft/callback')
  async handleMicrosoftCallback(
    @CurrentUser() user: { id: string },
    @Body() body: { code: string; emailAddress?: string; redirectUri?: string },
  ) {
    return this.mailService.handleMicrosoftCallback(user.id, body.code, body.redirectUri, body.emailAddress);
  }

  @Post('accounts/connect')
  async connectAccount(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      emailAddress: string;
      provider?: EmailProvider;
      displayName?: string;
      imapHost?: string;
      imapPort?: number;
      imapUser?: string;
      imapPassword?: string;
      imapTls?: boolean;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      smtpTls?: boolean;
    },
  ) {
    return this.mailService.connectAccount(user.id, body);
  }

  @Post('accounts/google-one-tap')
  async handleGoogleOneTap(
    @CurrentUser() user: { id: string },
    @Body('credential') credential: string,
  ) {
    return this.mailService.handleGoogleOneTap(user.id, credential);
  }

  @Delete('accounts/:id')
  async disconnectAccount(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.mailService.disconnectAccount(user.id, id);
  }

  @Post('accounts/:id/sync')
  async syncAccount(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.mailService.syncAccount(user.id, id);
  }

  @Get('messages')
  async getMessages(
    @CurrentUser() user: { id: string },
    @Query('accountId') accountId?: string,
    @Query('folder') folder?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mailService.getMessages(user.id, {
      accountId,
      folder,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('messages/:id')
  async getMessageById(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.mailService.getMessageById(user.id, id);
  }

  @Patch('messages/:id/read')
  async toggleRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: { isRead?: boolean },
  ) {
    return this.mailService.toggleRead(user.id, id, body?.isRead);
  }

  @Patch('messages/:id/star')
  async toggleStar(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.mailService.toggleStar(user.id, id);
  }

  @Delete('messages/:id')
  async deleteMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.mailService.deleteMessage(user.id, id);
  }

  @Post('messages/send')
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      accountId: string;
      to: string[];
      cc?: string[];
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      attachments?: Array<{
        fileName: string;
        fileUrl: string;
        fileSize: number;
        contentType: string;
      }>;
    },
  ) {
    return this.mailService.sendMessage(user.id, body);
  }

  @Post('messages/:id/share')
  async shareToChannel(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: { channelId: string; note?: string },
  ) {
    return this.mailService.shareToChannel(user.id, id, body.channelId, body.note);
  }
}
