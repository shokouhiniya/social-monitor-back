import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { UnauthorizedException } from '../common/exceptions';
import { AuthService } from './auth.service';
import { REQUEST_USER_KEY } from './auth.types';

/**
 * JwtAuthGuard — محافظت endpoint ها با JWT (Requirement 11.2).
 *
 * توکن از هدر `Authorization: Bearer <token>` استخراج و با `AuthService.validate`
 * تأیید می‌شود. در صورت نبود یا نامعتبر بودن توکن، `UnauthorizedException`
 * (کد نمادین UNAUTHORIZED) پرتاب می‌شود. کاربر تأییدشده روی
 * `request[REQUEST_USER_KEY]` قرار می‌گیرد تا `RolesGuard` و کنترلرها آن را
 * بخوانند.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('توکن احراز هویت ارائه نشده است');
    }

    // validate در صورت نامعتبر بودن توکن خودش UnauthorizedException پرتاب می‌کند.
    const user = await this.authService.validate(token);
    (request as unknown as Record<string, unknown>)[REQUEST_USER_KEY] = user;
    return true;
  }

  /** استخراج توکن از هدر `Authorization: Bearer <token>`. */
  private extractToken(request: Request): string | null {
    const header = request.headers?.authorization;
    if (!header || typeof header !== 'string') {
      return null;
    }
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      return null;
    }
    return value.trim() || null;
  }
}
