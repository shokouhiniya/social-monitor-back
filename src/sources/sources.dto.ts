import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';
import { SOURCE_PLATFORMS, SOURCE_STATUSES } from './source.types';
import { SOURCE_TIMEFRAMES } from './sources.delegation';

/**
 * DTO ساخت یک منبع (Source) جدید — نگاشت به جدول `pages`.
 *
 * فیلدهای مفهومی V2 (design §6.2) به ستون‌های موجود `pages` نگاشت می‌شوند:
 *  - `display_name` → ستون `name`
 *  - `last_analyzed_at` → ستون `last_processed_at`
 * در این DTO فیلدهای ورودی با نام ستون فیزیکی (`name`) نگه داشته شده‌اند تا با
 * موجودیت `Page` هم‌خوان باشند.
 *
 * `username` و `platform` با هم کلید منطقی یکتایی منبع را می‌سازند و در
 * bulkCreate برای dedupe استفاده می‌شوند (Requirement 2.3).
 */
export class CreateSourceDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @IsOptional()
  @IsIn(SOURCE_PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsString()
  profile_url?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profile_image_url?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  followers_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  following_count?: number;

  @IsOptional()
  @IsInt()
  network_id?: number;

  @IsOptional()
  @IsInt()
  cluster_id?: number;

  @IsOptional()
  @IsBoolean()
  is_representative?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/**
 * DTO به‌روزرسانی منبع. همهٔ فیلدها اختیاری‌اند (partial update).
 * تغییر cluster و وضعیت فعال‌سازی از endpointهای اختصاصی انجام می‌شود، اما برای
 * انعطاف، این DTO اجازهٔ به‌روزرسانی فیلدهای پروفایلی را می‌دهد.
 */
export class UpdateSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @IsOptional()
  @IsIn(SOURCE_PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsString()
  profile_url?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profile_image_url?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  followers_count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  following_count?: number;

  @IsOptional()
  @IsInt()
  network_id?: number;
}

/**
 * DTO واردات گروهی (bulk import) — فهرستی از منابع.
 * سرویس بر اساس کلید `username` + `platform` حذف تکراری می‌کند و تعداد
 * ایجادشده/ردشده را گزارش می‌دهد (Requirement 2.3).
 */
export class BulkCreateSourceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateSourceDto)
  sources: CreateSourceDto[];
}

/**
 * DTO تنظیم پرچم نماینده (representative) یک منبع (Requirement 2.5).
 */
export class SetRepresentativeDto {
  @IsBoolean()
  value: boolean;
}

/**
 * DTO اختصاص/حذف اختصاص خوشه (Requirement 2.4).
 * مقدار `null` به‌معنای حذف اختصاص خوشه است.
 */
export class AssignClusterDto {
  @IsOptional()
  @IsInt()
  clusterId: number | null;
}

/**
 * DTO تغییر وضعیت فعال/غیرفعال منبع (Requirement 2.6).
 */
export class SetStatusDto {
  @IsIn(SOURCE_STATUSES)
  status: string;
}

/**
 * Query لیست منابع — صفحه‌بندی مشترک به‌علاوهٔ فیلترهای اختیاری.
 * با `class-validator`/`class-transformer` کار می‌کند تا با ValidationPipe سراسری
 * سازگار باشد.
 */
export class SourceListQuery extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SOURCE_PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsIn(SOURCE_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  networkId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clusterId?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * DTO عملیات تحلیل یک منبع (Requirement 2.7 — `analyze(id, timeframe)`).
 * `timeframe` بازهٔ زمانی محتوای موردتحلیل را مشخص می‌کند؛ پیش‌فرض `all`.
 */
export class AnalyzeSourceDto {
  @IsOptional()
  @IsIn(SOURCE_TIMEFRAMES)
  timeframe?: string;
}

/**
 * Query تاریخچهٔ تحلیل یک منبع (Requirement 2.8). تنها صفحه‌بندی مشترک نیاز است.
 */
export class AnalysisHistoryQuery extends PaginationQueryDto {}
