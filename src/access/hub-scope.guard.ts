import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { HubUserEntity } from '../hubs/hub-user.entity';
import { REQUEST_USER_KEY } from '../auth/auth.types';
import { SafeUser, isPrivilegedRole } from '../users/user.types';
import {
  HubScope,
  REQUEST_HUB_SCOPE_KEY,
  isAuthEnforced,
} from './access.types';

/**
 * HubScopeGuard — محاسبهٔ محدودهٔ دسترسی هابِ کاربر و الصاق آن به request
 * (micromedia-transformation §6، Correctness Property 5).
 *
 * باید پس از `ScopedAuthGuard` اجرا شود (کاربر روی request قرار گرفته است).
 * برای پرهیز از وابستگی دوّار با HubsModule، مستقیماً جدول `hub_users` را
 * می‌خواند (نه از طریق HubsService).
 *
 * **غیرتخریبی:** اگر `AUTH_ENFORCE` فعال نباشد، scope «فراگیر» الصاق می‌شود.
 */
@Injectable()
export class HubScopeGuard implements CanActivate {
  constructor(
    @InjectRepository(HubUserEntity)
    private readonly hubUserRepo: Repository<HubUserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as unknown as Record<string, unknown>)[
      REQUEST_USER_KEY
    ] as SafeUser | undefined;

    let scope: HubScope;

    if (!isAuthEnforced() || !user) {
      scope = { userId: user?.id ?? null, role: user?.role ?? null, privileged: true, hubIds: [] };
    } else if (isPrivilegedRole(user.role)) {
      scope = { userId: user.id, role: user.role, privileged: true, hubIds: [] };
    } else {
      const links = await this.hubUserRepo.find({ where: { user_id: user.id } });
      scope = {
        userId: user.id,
        role: user.role,
        privileged: false,
        hubIds: links.map((l) => l.hub_id),
      };
    }

    (request as unknown as Record<string, unknown>)[REQUEST_HUB_SCOPE_KEY] =
      scope;
    return true;
  }
}
