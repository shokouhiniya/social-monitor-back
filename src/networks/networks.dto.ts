import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO ساخت network جدید. `name` و `slug` اجباری‌اند؛ بقیه اختیاری.
 * `slug` در جدول UNIQUE است؛ یکتایی آن در سرویس بررسی می‌شود.
 */
export class CreateNetworkDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(255)
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  default_language?: string;

  @IsOptional()
  @IsString()
  target_narrative?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/**
 * DTO به‌روزرسانی network. همهٔ فیلدها اختیاری‌اند (partial update).
 */
export class UpdateNetworkDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  default_language?: string;

  @IsOptional()
  @IsString()
  target_narrative?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
