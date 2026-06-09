import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/user/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

/**
 * UsersModule — مدیریت کاربران داخلی (design §5.12).
 *
 * «User» روی همان جدول موجود `users` نگاشت می‌شود؛ بنابراین به‌جای تعریف یک
 * entity دوم، موجودیت موجود `User` دوباره استفاده می‌شود
 * (`TypeOrmModule.forFeature([User])`) تا تعارض metadata رخ ندهد — مطابق الگوی
 * Source=Page در تسک ۳.۴.
 *
 * در `app.module.ts` به‌صورت dual-import در کنار `UserModule` (legacy) ثبت
 * می‌شود (Requirement 1.6). `UsersService` صادر می‌شود تا `AuthModule` بتواند
 * آن را مصرف کند (گراف وابستگی بدون‌دور — Requirement 1.2).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
