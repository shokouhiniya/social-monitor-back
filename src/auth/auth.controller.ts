import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginV2Dto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { REQUEST_USER_KEY } from './auth.types';
import { SafeUser } from '../users/user.types';

/**
 * کنترلر احراز هویت V2 (design §5.12).
 *
 * **تصمیم مرزی (تداخل مسیر):** کنترلر legacy `modules/auth` مالک `/auth/login`
 * است و در دورهٔ گذار باید دست‌نخورده کار کند (Requirement 1.6). برای اجتناب از
 * تداخل، این کنترلر روی فضای‌نام مجزای `/auth/v2` ثبت می‌شود.
 *
 * مسیرها:
 *  - `POST /auth/v2/login` — صدور JWT + SafeUser (Requirement 11.1).
 *  - `GET  /auth/v2/me` — کاربر جاری (نمونهٔ مصرف JwtAuthGuard، Requirement 11.2).
 *  - `GET  /auth/v2/admin-check` — نمونهٔ کاربردی محافظت admin-only با
 *    JwtAuthGuard + @Roles('admin') (زیرساخت Requirement 11.4 که تسک ۵.۵ آن را
 *    روی PromptsModule اعمال خواهد کرد).
 */
@Controller('auth/v2')
export class AuthV2Controller {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginV2Dto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request): SafeUser {
    return (request as unknown as Record<string, unknown>)[
      REQUEST_USER_KEY
    ] as SafeUser;
  }

  /**
   * نمونهٔ endpoint محافظت‌شدهٔ admin-only. ترتیب guard ها مهم است: ابتدا
   * JwtAuthGuard (احراز هویت → UNAUTHORIZED در صورت نبود توکن)، سپس RolesGuard
   * (نقش → FORBIDDEN در صورت نقش غیرمجاز).
   */
  @Get('admin-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminCheck(@Req() request: Request): { ok: true; user: SafeUser } {
    const user = (request as unknown as Record<string, unknown>)[
      REQUEST_USER_KEY
    ] as SafeUser;
    return { ok: true, user };
  }
}
