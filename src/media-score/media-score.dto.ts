import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** DTO ساخت شاخص امتیاز (super_admin). */
export class CreateIndicatorDto {
  @IsString() @MaxLength(128) key: string;
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() min_value?: number;
  @IsOptional() @Type(() => Number) @IsNumber() max_value?: number;
  @IsOptional() @Type(() => Number) @IsNumber() weight?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
}

/** DTO به‌روزرسانی شاخص (partial). */
export class UpdateIndicatorDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() min_value?: number;
  @IsOptional() @Type(() => Number) @IsNumber() max_value?: number;
  @IsOptional() @Type(() => Number) @IsNumber() weight?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
}

/** DTO ثبت/به‌روزرسانی یک رکورد امتیاز (upsert بر اساس period). */
export class CreateScoreRecordDto {
  @Type(() => Number) @IsInt() micro_media_id: number;
  @Type(() => Number) @IsInt() indicator_id: number;
  @Type(() => Number) @IsNumber() value: number;

  /** ISO date (شروع دوره؛ مثلاً اول ماه). */
  @IsString() period_start: string;

  @IsOptional() @IsString() period_end?: string;
  @IsOptional() @Type(() => Number) @IsInt() scored_by_user_id?: number;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

/** یک مقدار شاخص در ثبت گروهی. */
export class BatchScoreItemDto {
  @Type(() => Number) @IsInt() indicator_id: number;
  @Type(() => Number) @IsNumber() value: number;
}

/** DTO ثبت گروهی امتیازِ چند شاخص برای یک میکرورسانه در یک دوره. */
export class BatchScoreDto {
  @Type(() => Number) @IsInt() micro_media_id: number;

  @IsString() period_start: string;

  @IsOptional() @Type(() => Number) @IsInt() scored_by_user_id?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchScoreItemDto)
  scores: BatchScoreItemDto[];
}
