import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { REQUEST_USER_KEY } from '../auth/auth.types';
import { SafeUser } from '../users/user.types';
import { PaginationQueryDto } from '../common/pagination';
import { PromptsService } from './prompts.service';
import {
  CreatePromptVersionDto,
  SetPromptActiveDto,
  TestPromptDto,
} from './prompts.dto';

/**
 * کنترلر Prompt Studio (PromptsController — design §5.7 / §7.2).
 *
 * **محافظت admin-only (Requirement 11.4 / design §5.12):** عملیات تغییردهنده
 * (ساخت نسخه، فعال‌سازی نسخه و enable/disable) با `JwtAuthGuard + RolesGuard` و
 * `@Roles('admin')` محافظت می‌شوند. ترتیب guardها مهم است: ابتدا احراز هویت
 * (UNAUTHORIZED در نبود توکن)، سپس نقش (FORBIDDEN برای نقش غیرمجاز). endpointهای
 * فقط‌خواندنی (list/get/executions) و `test` بدون قفل باقی می‌مانند تا UI بتواند
 * prompt را آزمایش و مرور کند (تصمیم مرزی هم‌راستا با AuthV2Module که هیچ guard
 * سراسری ثبت نمی‌کند).
 *
 * بسته‌بندی Response Envelope توسط ResponseInterceptor سراسری و نگاشت خطا توسط
 * AllExceptionsFilter انجام می‌شود (Requirement 12).
 */
@Controller('prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  /** GET /prompts — فهرست همهٔ تعاریف prompt (Requirement 6.1). */
  @Get()
  listDefinitions() {
    return this.promptsService.listDefinitions();
  }

  /** GET /prompts/:key — جزئیات یک prompt به‌همراه نسخه‌ها. */
  @Get(':key')
  getByKey(@Param('key') key: string) {
    return this.promptsService.getByKey(key);
  }

  /** GET /prompts/:key/executions — تاریخچهٔ صفحه‌بندی‌شدهٔ اجراها (Requirement 6.7). */
  @Get(':key/executions')
  getExecutions(
    @Param('key') key: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.promptsService.getExecutions(key, query);
  }

  /**
   * POST /prompts/:key/versions — ساخت نسخهٔ جدید (Requirement 6.2). admin-only.
   */
  @Post(':key/versions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createVersion(
    @Param('key') key: string,
    @Body() dto: CreatePromptVersionDto,
    @Req() request: Request,
  ) {
    return this.promptsService.createVersion(
      key,
      dto,
      this.currentUserId(request),
    );
  }

  /**
   * PATCH /prompts/:key/versions/:versionId/activate — فعال‌سازی یک نسخه
   * (Requirement 6.3). admin-only.
   */
  @Patch(':key/versions/:versionId/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  activateVersion(
    @Param('key') key: string,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Req() request: Request,
  ) {
    return this.promptsService.activateVersion(
      key,
      versionId,
      this.currentUserId(request),
    );
  }

  /**
   * POST /prompts/:key/test — تست دستی prompt با ورودی نمونه (Requirement 6.5).
   * در دسترس برای کاربران احرازشده (هر نقش) تا UI بتواند خروجی را آزمایش کند.
   */
  @Post(':key/test')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  test(@Param('key') key: string, @Body() dto: TestPromptDto) {
    return this.promptsService.test(key, dto.sampleInput, dto.versionId);
  }

  /**
   * PATCH /prompts/:key/active — فعال/غیرفعال کردن یک prompt (Requirement 6.8).
   * admin-only.
   */
  @Patch(':key/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setActive(@Param('key') key: string, @Body() dto: SetPromptActiveDto) {
    return this.promptsService.setActive(key, dto.is_active);
  }

  /** استخراج شناسهٔ کاربر جاری از request (پس از JwtAuthGuard). */
  private currentUserId(request: Request): number | undefined {
    const user = (request as unknown as Record<string, unknown>)[
      REQUEST_USER_KEY
    ] as SafeUser | undefined;
    return user?.id;
  }
}
