import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * ورودی login برای auth نسخهٔ V2 (Requirement 11.1).
 *
 * نام این کلاس عمداً `LoginV2Dto` است تا با `LoginDto` ماژول legacy
 * (`modules/auth`) اشتباه گرفته نشود؛ هر دو در دورهٔ گذار هم‌زمان وجود دارند.
 */
export class LoginV2Dto {
  @IsString()
  @IsNotEmpty({ message: 'نام کاربری الزامی است' })
  @MaxLength(128)
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'رمز عبور الزامی است' })
  @MinLength(1)
  @MaxLength(256)
  password: string;
}
