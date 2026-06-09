import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthV2Module } from '../auth/auth.module';
import { HubUserEntity } from '../hubs/hub-user.entity';
import { ScopedAuthGuard } from './scoped-auth.guard';
import { HubScopeGuard } from './hub-scope.guard';

/**
 * AccessModule — زیرساخت کنترل دسترسی محصول جدید (micromedia-transformation §6).
 *
 * گاردها به‌صورت **APP_GUARD سراسری** ثبت می‌شوند تا در context خودِ AccessModule
 * (که AuthService و repository جدول `hub_users` را دارد) ساخته شوند و مشکل
 * UnknownDependencies در ماژول‌های مصرف‌کننده رخ ندهد. ترتیب: ابتدا
 * `ScopedAuthGuard` (احراز هویت/نقش) سپس `HubScopeGuard` (محاسبهٔ scope).
 *
 * هر دو گارد **flag-gated و route-scoped** هستند: تا `AUTH_ENFORCE=true` نباشد و
 * مسیر از مسیرهای محصول جدید نباشد، هیچ اثری ندارند (مسیرهای legacy باز می‌مانند).
 */
@Global()
@Module({
  imports: [AuthV2Module, TypeOrmModule.forFeature([HubUserEntity])],
  providers: [
    ScopedAuthGuard,
    HubScopeGuard,
    { provide: APP_GUARD, useExisting: ScopedAuthGuard },
    { provide: APP_GUARD, useExisting: HubScopeGuard },
  ],
  exports: [ScopedAuthGuard, HubScopeGuard],
})
export class AccessModule {}
