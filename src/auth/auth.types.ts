import { UserRole } from '../users/user.types';

/**
 * payload امضاشده در JWT (Requirement 11.1).
 *  - `sub`: شناسهٔ کاربر (subject استاندارد JWT).
 *  - `role`: نقش کاربر برای enforcement سریع در RolesGuard.
 */
export interface JwtPayload {
  sub: number;
  role: UserRole;
}

/**
 * کلیدی که کاربر احرازشده روی شیء request قرار می‌گیرد (توسط JwtAuthGuard) تا
 * RolesGuard و کنترلرها بتوانند آن را بخوانند.
 */
export const REQUEST_USER_KEY = 'user';
