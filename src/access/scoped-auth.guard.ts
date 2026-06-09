import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { REQUEST_USER_KEY } from '../auth/auth.types';
import { ROLES_METADATA_KEY } from '../auth/roles.decorator';
import { SafeUser, UserRole } from '../users/user.types';
import { ForbiddenException, UnauthorizedException } from '../common/exceptions';
import { isAuthEnforced, isNewRoute } from './access.types';

/**
 * ScopedAuthGuard — گارد سراسری (APP_GUARD) احراز هویت + نقش، با enforcement
 * قابل‌تنظیم و محدود به مسیرهای محصول جدید (micromedia-transformation §6، تصمیم ۶).
 *
 * **غیرتخریبی (دو لایه محافظت):**
 *  1. اگر `AUTH_ENFORCE` فعال نباشد → هیچ محدودیتی (best-effort الصاق کاربر).
 *  2. حتی با enforcement، تنها روی مسیرهای جدید (`isNewRoute`) اعمال می‌شود؛
 *     مسیرهای legacy باز می‌مانند.
 */
@Injectable()
export class ScopedAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    const path = request.path ?? request.url ?? '';
    const enforced = isAuthEnforced() && isNewRoute(path);

    if (!enforced) {
      // best-effort: اگر توکن معتبر بود کاربر را الصاق کن، وگرنه بی‌سروصدا عبور بده.
      if (token) {
        try {
          const user = await this.authService.validate(token);
          this.attachUser(request, user);
        } catch {
          // توکن نامعتبر در حالت غیر-enforced نادیده گرفته می‌شود.
        }
      }
      return true;
    }

    // enforced
    if (!token) {
      throw new UnauthorizedException('توکن احراز هویت ارائه نشده است');
    }
    const user = await this.authService.validate(token);
    this.attachUser(request, user);

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role)) {
        throw new ForbiddenException(
          'شما مجوز لازم برای دسترسی به این بخش را ندارید',
        );
      }
    }
    return true;
  }

  private attachUser(request: Request, user: SafeUser): void {
    (request as unknown as Record<string, unknown>)[REQUEST_USER_KEY] = user;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers?.authorization;
    if (!header || typeof header !== 'string') return null;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
    return value.trim() || null;
  }
}
