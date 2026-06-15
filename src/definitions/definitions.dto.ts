import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const DEFINITION_TYPES = ['identity', 'platform', 'tag'] as const;

/** DTO ساخت یک تعریف (هویت/سکو). */
export class CreateDefinitionDto {
  @IsIn(DEFINITION_TYPES as readonly string[]) type: string;
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsString() @MaxLength(64) key?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(128) icon?: string;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

/** DTO به‌روزرسانی یک تعریف. */
export class UpdateDefinitionDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() @MaxLength(64) key?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(128) icon?: string;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
