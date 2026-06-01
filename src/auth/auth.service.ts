import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '../common/exceptions';
import { UsersService } from '../users/users.service';
import { SafeUser, toSafeUser } from '../users/user.types';
import { verifyPassword } from '../users/password.util';
import { LoginV2Dto } from './auth.dto';
import { JwtPayload } from './auth.types';

/**
 * سرویس احراز هویت V2 (AuthService — design §5.12).
 *
 *  - `login`: اعتبارسنجی username/password در برابر هش ذخیره‌شده و صدور یک JWT
 *    واقعی امضاشده با payload `{ sub, role }` به‌همراه `SafeUser`
 *    (Requirement 11.1).
 *  - `validate`: تأیید امضای JWT و بازگرداندن `SafeUser` متناظر
 *    (Requirement 11.1). در صورت نامعتبر بودن توکن یا نبود کاربر/غیرفعال بودن،
 *    `UnauthorizedException` (کد نمادین UNAUTHORIZED — Requirement 11.2).
 *
 * نکتهٔ امنیتی: پیام خطای login عمداً مبهم است («نام کاربری یا رمز عبور اشتباه
 * است») تا وجود/عدم وجود یک username افشا نشود (جلوگیری از user enumeration).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * login با اعتبار معتبر → صدور JWT + SafeUser (Requirement 11.1).
   * اعتبار نامعتبر یا کاربر غیرفعال → UnauthorizedException.
   */
  async login(dto: LoginV2Dto): Promise<{ token: string; user: SafeUser }> {
    const user = await this.usersService.findByUsernameWithSecret(dto.username);

    // پیام یکسان برای «کاربر یافت نشد» و «رمز اشتباه» (جلوگیری از enumeration).
    const invalidCredentials = () =>
      new UnauthorizedException('نام کاربری یا رمز عبور اشتباه است');

    if (!user) {
      throw invalidCredentials();
    }
    if (!user.is_active) {
      throw new UnauthorizedException('حساب کاربری غیرفعال است');
    }

    const passwordOk = await verifyPassword(dto.password, user.password_hash);
    if (!passwordOk) {
      throw invalidCredentials();
    }

    const safeUser = toSafeUser(user);
    const payload: JwtPayload = { sub: safeUser.id, role: safeUser.role };
    const token = await this.jwtService.signAsync(payload);

    return { token, user: safeUser };
  }

  /**
   * تأیید یک JWT و بازگرداندن SafeUser (Requirement 11.1). در صورت نامعتبر/منقضی
   * بودن توکن یا نبود کاربر یا غیرفعال بودن، UnauthorizedException.
   */
  async validate(token: string): Promise<SafeUser> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('توکن نامعتبر یا منقضی است');
    }

    if (!payload || typeof payload.sub !== 'number') {
      throw new UnauthorizedException('توکن نامعتبر است');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('کاربر متناظر با توکن یافت نشد');
    }
    if (!user.is_active) {
      throw new UnauthorizedException('حساب کاربری غیرفعال است');
    }

    return user;
  }
}
