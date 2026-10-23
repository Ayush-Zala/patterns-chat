import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaService } from '../common/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { MessagesGateway } from '../messages/messages.gateway.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => MessagesGateway))
    private readonly messagesGateway: MessagesGateway,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(dto.name.trim())}&backgroundColor=4f46e5,7c3aed,9333ea`;
    const sessionId = crypto.randomUUID();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        name: dto.name.trim(),
        password: hashedPassword,
        avatarUrl,
        status: 'Active',
        currentSessionId: sessionId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      sessionId,
    });

    return {
      message: 'Account registered successfully',
      user,
      accessToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const sessionId = crypto.randomUUID();

    // Update current session ID in database
    await this.prisma.user.update({
      where: { id: user.id },
      data: { currentSessionId: sessionId },
    });

    // Notify any active sockets on other devices to force logout immediately
    try {
      if (this.messagesGateway) {
        this.messagesGateway.emitForceLogout(user.id, sessionId);
      }
    } catch (e) {
      // Gateway error ignored
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      sessionId,
    });

    const sanitizedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
    };

    return {
      message: 'Logged in successfully',
      user: sanitizedUser,
      accessToken,
    };
  }

  async googleLogin(payload: { email?: string; name?: string; avatarUrl?: string }) {
    const email = (payload.email || 'yshah0611@gmail.com').toLowerCase().trim();
    const name = payload.name?.trim() || (email === 'yshah0611@gmail.com' ? 'Yash Shah' : email.split('@')[0]) || 'Google User';
    const avatarUrl =
      payload.avatarUrl ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=4285F4,34A853,FBBC05,EA4335`;

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    const sessionId = crypto.randomUUID();

    if (!user) {
      const dummyPassword = await bcrypt.hash(crypto.randomUUID(), 10);
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          password: dummyPassword,
          avatarUrl,
          status: 'Active',
          currentSessionId: sessionId,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { currentSessionId: sessionId },
      });
    }

    try {
      if (this.messagesGateway) {
        this.messagesGateway.emitForceLogout(user.id, sessionId);
      }
    } catch (e) {
      // Gateway error ignored
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      sessionId,
    });

    const sanitizedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
    };

    return {
      message: 'Google login successful',
      user: sanitizedUser,
      accessToken,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        workspaceMembers: {
          select: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return user;
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
    const updateData: { name?: string; avatarUrl?: string } = {};
    if (data.name && data.name.trim()) {
      updateData.name = data.name.trim();
    }
    if (data.avatarUrl) {
      updateData.avatarUrl = data.avatarUrl;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      message: 'Profile updated successfully',
      user: updatedUser,
    };
  }
}
