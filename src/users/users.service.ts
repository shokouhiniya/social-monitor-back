import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../modules/user/user.entity';
import { ConflictException, NotFoundException } from '../common/exceptions';
import { hashPassword } from './password.util';
import {
  DEFAULT_USER_ROLE,
  SafeUser,
  toSafeUser,
  UserRole,
} from './user.types';

/** ورودی ساخت یک کاربر داخلی جدید. */
export interface CreateInternalUserInput {
  name: string;
  username: string;
  password: string;
  role?: UserRole;
  /** شمارهٔ تماس؛ ستون `phone` در جدول `users` غیر-NULL و unique است. */
  phone?: string;
}

/**
 * سرویس مدیریت کاربران داخلی (UsersModule — design §5.12).
 *
 * «User» روی همان جدول موجود `users` نگاشت می‌شود؛ بنابراین به‌جای تعریف یک
 * entity دوم، موجودیت موجود `User` (متعلق به ماژول legacy) دوباره استفاده
 * می‌شود (`TypeOrmModule.forFeature([User])`) تا تعارض metadata در TypeORM رخ
 * ندهد — مطابق الگوی Source=Page در تسک ۳.۴.
 *
 * این سرویس هرگز `password_hash` را به بیرون نشت نمی‌دهد؛ متدهای عمومیِ
 * بازگرداننده به کلاینت `SafeUser` برمی‌گردانند. تنها متد داخلی
 * `findByUsernameWithSecret` (برای AuthService) موجودیت کامل را برمی‌گرداند تا
 * تأیید رمز عبور ممکن باشد.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * یافتن یک کاربر بر اساس username و بازگرداندن نسخهٔ امن (بدون password_hash).
   * اگر کاربری یافت نشود `null` برمی‌گرداند.
   */
  async findByUsername(username: string): Promise<SafeUser | null> {
    const user = await this.userRepository.findOne({ where: { username } });
    return user ? toSafeUser(user) : null;
  }

  /**
   * یافتن موجودیت کامل کاربر بر اساس username — **تنها برای استفادهٔ داخلی
   * AuthService** جهت تأیید رمز عبور. این متد `password_hash` را شامل می‌شود و
   * نباید نتیجه‌اش مستقیماً به کلاینت بازگردانده شود.
   */
  async findByUsernameWithSecret(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  /**
   * یافتن یک کاربر بر اساس id و بازگرداندن نسخهٔ امن. اگر یافت نشود `null`.
   */
  async findById(id: number): Promise<SafeUser | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    return user ? toSafeUser(user) : null;
  }

  /**
   * یافتن یک کاربر بر اساس id یا پرتاب NotFoundException (نسخهٔ امن).
   */
  async getById(id: number): Promise<SafeUser> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`کاربری با شناسهٔ ${id} یافت نشد`);
    }
    return user;
  }

  /**
   * ساخت یک کاربر داخلی جدید با نقش مشخص و رمز عبور هش‌شده (Requirement 11.1،
   * 11.3). در صورت تکراری بودن username، ConflictException پرتاب می‌شود.
   * نتیجهٔ بازگشتی `SafeUser` است (بدون password_hash).
   */
  async createInternalUser(
    input: CreateInternalUserInput,
  ): Promise<SafeUser> {
    const existing = await this.userRepository.findOne({
      where: { username: input.username },
    });
    if (existing) {
      throw new ConflictException(
        `کاربری با نام کاربری «${input.username}» از قبل وجود دارد`,
      );
    }

    const password_hash = await hashPassword(input.password);
    const user = this.userRepository.create({
      name: input.name,
      username: input.username,
      password_hash,
      role: input.role ?? DEFAULT_USER_ROLE,
      // ستون phone در جدول users غیر-NULL و unique است؛ اگر شماره‌ای ارائه نشود
      // یک placeholder یکتا تولید می‌شود تا constraint نقض نشود.
      phone: input.phone ?? `internal-${input.username}`,
      is_active: true,
    });

    const saved = await this.userRepository.save(user);
    return toSafeUser(saved);
  }

  /**
   * فهرست همهٔ کاربران داخلی (SafeUser) برای پنل مدیریت super_admin.
   */
  async listUsers(): Promise<SafeUser[]> {
    const users = await this.userRepository.find({ order: { id: 'ASC' } });
    return users.map(toSafeUser);
  }

  /**
   * به‌روزرسانی نام/نقش/وضعیت فعال یک کاربر (پنل super_admin). نتیجهٔ امن.
   */
  async updateUser(
    id: number,
    input: { name?: string; role?: UserRole; is_active?: boolean },
  ): Promise<SafeUser> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`کاربری با شناسهٔ ${id} یافت نشد`);
    }
    if (input.name !== undefined) user.name = input.name;
    if (input.role !== undefined) user.role = input.role;
    if (input.is_active !== undefined) user.is_active = input.is_active;
    const saved = await this.userRepository.save(user);
    return toSafeUser(saved);
  }

  /**
   * بازنشانی رمز عبور یک کاربر (پنل super_admin). رمز هش‌شده ذخیره می‌شود.
   */
  async setPassword(id: number, password: string): Promise<SafeUser> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`کاربری با شناسهٔ ${id} یافت نشد`);
    }
    user.password_hash = await hashPassword(password);
    const saved = await this.userRepository.save(user);
    return toSafeUser(saved);
  }

  /**
   * تضمین وجود یک کاربر داخلی (idempotent). اگر username وجود داشته باشد همان
   * بازگردانده می‌شود؛ در غیر این صورت ساخته می‌شود. برای seed بوت‌استرپ ادمین
   * استفاده می‌شود.
   */
  async ensureInternalUser(
    input: CreateInternalUserInput,
  ): Promise<{ user: SafeUser; created: boolean }> {
    const existing = await this.findByUsername(input.username);
    if (existing) {
      return { user: existing, created: false };
    }
    const user = await this.createInternalUser(input);
    return { user, created: true };
  }
}
