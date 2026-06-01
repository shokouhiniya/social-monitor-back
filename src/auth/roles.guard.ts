import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ForbiddenException, UnauthorizedException } from '../common/exceptions';
import { ROLES_METADATA_KEY } from './roles.decorator';
import { REQUEST_USER_KEY } from './auth.types';
import { SafeUser, UserRole } from '../users/user.types';

/**
 * RolesGuard — enforcement نقش‌ها (Requirement 11.3, 11.4).
 *
 * نقش‌های مجاز را از metadata دکوریتور `@Roles(...)` می‌خواند (سطح handler یا
 * controller). اگر هیچ نقشی تعیین نشده باشد، اجازهٔ عبور می‌دهد (این guard تنها
 * نقش را بررسی می‌کند؛ احراز هویت بر عهدهٔ JwtAuthGuard است).
 *
 * این guard فرض می‌کند `JwtAuthGuard` پیش از آن اجرا شده و کاربر را روی
 * `request[REQUEST_USER_KEY]` قرار داده است. اگر کاربری روی request نباشد،
 * `UnauthorizedException` (UNAUTHORIZED). اگر نقش کاربر در فهرست مجاز نباشد،
 * `ForbiddenException` (FORBIDDEN — Requirement 11.4).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // بدون @Roles → این guard محدودیتی اعمال نمی‌کند.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as unknown as Record<string, unknown>)[
      REQUEST_USER_KEY
    ] as SafeUser | undefined;

    if (!user) {
      throw new UnauthorizedException('احراز هویت لازم است');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'شما مجوز لازم برای دسترسی به این بخش را ندارید',
      );
    }

    return true;
  }
}
