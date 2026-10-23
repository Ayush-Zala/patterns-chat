import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('google')
  async googleLogin(
    @Body() body: { email?: string; name?: string; avatarUrl?: string },
  ) {
    return this.authService.googleLogin(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() body: { name?: string; avatarUrl?: string },
  ) {
    return this.authService.updateProfile(user.id, body);
  }

  // Google OAuth Endpoints
  @Get('oauth/google/url')
  getGoogleAuthUrl() {
    return this.authService.getGoogleAuthUrl();
  }

  @HttpCode(HttpStatus.OK)
  @Post('oauth/google/callback')
  async handleGoogleCallback(
    @Body('code') code: string,
    @Body('currentUserId') currentUserId?: string,
  ) {
    return this.authService.handleGoogleCallback(code, undefined, currentUserId);
  }

  // Microsoft OAuth Endpoints
  @Get('oauth/microsoft/url')
  getMicrosoftAuthUrl() {
    return this.authService.getMicrosoftAuthUrl();
  }

  @HttpCode(HttpStatus.OK)
  @Post('oauth/microsoft/callback')
  async handleMicrosoftCallback(@Body('code') code: string) {
    return this.authService.handleMicrosoftCallback(code);
  }
}

