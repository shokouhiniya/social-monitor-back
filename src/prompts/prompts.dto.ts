import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PromptResponseFormat } from '../ai/ai.types';

/** قالب‌های پاسخ مجاز برای یک نسخهٔ prompt. */
const RESPONSE_FORMATS: PromptResponseFormat[] = ['json', 'text'];

/**
 * DTOهای PromptsModule (design §5.7).
 *
 * با `class-validator`/ValidationPipe سراسری (`whitelist: true`) سازگارند.
 */

/**
 * DTO ساخت یک نسخهٔ جدید برای یک prompt (Requirement 6.2).
 *
 * شمارهٔ نسخه (`version`) توسط سرویس به‌صورت افزایشی تعیین می‌شود و در ورودی
 * پذیرفته نمی‌شود. `is_active` نیز از این مسیر تنظیم نمی‌شود؛ فعال‌سازی از طریق
 * `activateVersion` انجام می‌شود (Requirement 6.3).
 */
export class CreatePromptVersionDto {
  @IsString()
  @MinLength(1)
  template: string;

  @IsOptional()
  @IsString()
  extra_instructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsIn(RESPONSE_FORMATS)
  response_format?: PromptResponseFormat;
}

/**
 * DTO تست دستی یک prompt با ورودی نمونه (Requirement 6.5).
 *
 * `versionId` اختیاری است؛ در نبود آن، نسخهٔ فعال اجرا می‌شود.
 */
export class TestPromptDto {
  @IsObject()
  sampleInput: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  versionId?: number;
}

/** DTO فعال/غیرفعال کردن یک prompt (Requirement 6.8). */
export class SetPromptActiveDto {
  @IsBoolean()
  is_active: boolean;
}
