import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.types';

/** کلید metadata که نقش‌های مجاز یک endpoint را نگه می‌دارد. */
export const ROLES_METADATA_KEY = 'auth:roles';

/**
 * دکوریتور `@Roles(...)` — نقش‌های مجاز برای دسترسی به یک handler/controller را
 * مشخص می‌کند (Requirement 11.4). همراه با `RolesGuard` استفاده می‌شود.
 *
 * مثال: `@Roles('admin')` تنها به نقش admin اجازهٔ دسترسی می‌دهد
 * (محافظت admin-only از settings/prompts).
 */
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
