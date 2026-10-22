import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service.js';

export interface JwtPayload {
  sub: string;
  email: string;
  sessionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret', 'teamflow-jwt-secret-key-change-in-production-2026'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        currentSessionId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or session expired');
    }

    if (payload.sessionId && user.currentSessionId && payload.sessionId !== user.currentSessionId) {
      throw new UnauthorizedException('SESSION_SUPERSEDED: Logged in from another device');
    }

    return user;
  }
}
