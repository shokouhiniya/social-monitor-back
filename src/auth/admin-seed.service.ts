import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UsersService } from '../users/users.service';

/**
 * سرویس bootstrap یک کاربر admin اولیه (Requirement 11 — قابلیت ورود اولیه).
 *
 * **تصمیم مرزی امنیتی (seed امن):** هرگز رمز عبور ضعیف hardcode نمی‌شود. کاربر
 * admin تنها در صورتی seed می‌شود که هر دو متغیر محیطی `ADMIN_USERNAME` و
 * `ADMIN_PASSWORD` تنظیم شده باشند. اگر تنظیم نشده باشند، یک هشدار لاگ می‌شود و
 * seed رد می‌شود (به‌جای ساخت یک حساب با اعتبار پیش‌فرض ناامن). متغیر اختیاری
 * `ADMIN_NAME` نام نمایشی و `ADMIN_PHONE` شمارهٔ تماس را تعیین می‌کند.
 *
 * عملیات idempotent است: اگر username از قبل وجود داشته باشد، چیزی ساخته نمی‌شود
 * و رمز عبور موجود بازنویسی نمی‌شود.
 */
@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(private readonly usersService: UsersService) {}

  async onModuleInit(): Promise<void> {
    await this.seedAdmin();
  }

  /**
   * seed امن کاربر admin از متغیرهای محیطی. در نبود اعتبار، هشدار می‌دهد و رد
   * می‌کند. نتیجه را برای امکان فراخوانی دستی/تست بازمی‌گرداند.
   */
  async seedAdmin(): Promise<{ status: 'skipped' | 'created' | 'exists' }> {
    const username = process.env.ADMIN_USERNAME?.trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      this.logger.warn(
        '⚠️  ADMIN_USERNAME/ADMIN_PASSWORD تنظیم نشده‌اند — seed کاربر admin رد شد. ' +
          'برای فعال‌سازی login، این متغیرهای محیطی را تنظیم کنید (رمز عبور قوی).',
      );
      return { status: 'skipped' };
    }

    const { created } = await this.usersService.ensureInternalUser({
      name: process.env.ADMIN_NAME?.trim() || 'مدیر سیستم',
      username,
      password,
      role: 'admin',
      phone: process.env.ADMIN_PHONE?.trim() || `internal-${username}`,
    });

    if (created) {
      this.logger.log(`✅ کاربر admin اولیه با نام کاربری «${username}» ساخته شد`);
      return { status: 'created' };
    }

    this.logger.log(
      `✅ کاربر admin با نام کاربری «${username}» از قبل وجود دارد — seed رد شد`,
    );
    return { status: 'exists' };
  }
}
