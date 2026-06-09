import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { USER_ROLES, UserRole } from './user.types';

/** DTO ساخت کاربر داخلی جدید (پنل super_admin). */
export class CreateUserDto {
  @IsString() @MaxLength(255) name: string;
  @IsString() @MinLength(3) @MaxLength(64) username: string;
  @IsString() @MinLength(6) @MaxLength(128) password: string;
  @IsOptional() @IsIn(USER_ROLES as readonly string[]) role?: UserRole;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
}

/** DTO به‌روزرسانی کاربر (نام/نقش/فعال‌بودن). */
export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsIn(USER_ROLES as readonly string[]) role?: UserRole;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

/** DTO بازنشانی رمز عبور. */
export class SetPasswordDto {
  @IsString() @MinLength(6) @MaxLength(128) password: string;
}
