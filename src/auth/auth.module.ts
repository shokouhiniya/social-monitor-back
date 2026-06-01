import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthV2Controller } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { AdminSeedService } from './admin-seed.service';

/**
 * AuthModule (V2) — احراز هویت با JWT، نقش‌ها و guardها (design §5.12،
 * Requirement 11.1–11.4).
 *
 * **تصمیم مرزی (تداخل نام/مسیر):** ماژول legacy `modules/auth` در دورهٔ گذار
 * حفظ می‌شود (Requirement 1.6). این ماژول جدید با نام `AuthV2Module` و کنترلر
 * روی فضای‌نام `/auth/v2` ثبت می‌شود تا با `/auth/login` legacy تداخل نکند.
 *
 * `JwtModule` با `secret`/`expiresIn` از `configuration.ts` (کلید `jwt`) ثبت
 * می‌شود (registerAsync + ConfigService) تا منبع واحد پیکربندی حفظ شود.
 *
 * Guardها (`JwtAuthGuard`, `RolesGuard`) به‌صورت provider صادر می‌شوند تا
 * ماژول‌های دیگر (مثلاً PromptsModule در تسک ۵.۵) بتوانند با
 * `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')` از آن‌ها استفاده
 * کنند. این ماژول عمداً هیچ guard سراسری (APP_GUARD) ثبت نمی‌کند تا endpoint های
 * موجود/legacy و فرانت فعلی (که هنوز auth واقعی ندارد) قفل نشوند — محافظت
 * admin-only به‌صورت opt-in روی سطح V2 اعمال می‌شود (تصمیم مرزی امنیتی).
 */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn') ?? '60m',
        },
      }),
    }),
  ],
  controllers: [AuthV2Controller],
  providers: [AuthService, JwtAuthGuard, RolesGuard, AdminSeedService],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthV2Module {}
