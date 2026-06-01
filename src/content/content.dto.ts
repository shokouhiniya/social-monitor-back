import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';
import { CONTENT_PLATFORMS } from './content.types';

/**
 * Query فید محتوا (design §5.3 — `findFeed(query)` و Requirement 3.1).
 *
 * صفحه‌بندی مشترک (`page`/`pageSize`) را از `PaginationQueryDto` به ارث می‌برد و
 * فیلترهای اختیاری فید را اضافه می‌کند: platform (join به `pages`)، sourceId
 * (→ `page_id`)، نوع محتوا، برچسب احساس، جستجوی متنی و بازهٔ زمانی انتشار.
 */
export class ContentFeedQuery extends PaginationQueryDto {
  /** فیلتر پلتفرم — از طریق join به جدول `pages` اعمال می‌شود. */
  @IsOptional()
  @IsIn(CONTENT_PLATFORMS)
  platform?: string;

  /** فیلتر منبع (مفهوم V2 `source_id` → ستون `page_id`). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceId?: number;

  /** فیلتر خوشه (از طریق join به `pages.cluster_id`). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clusterId?: number;

  /** فیلتر نوع محتوا (`post_type`). */
  @IsOptional()
  @IsString()
  contentType?: string;

  /** فیلتر برچسب احساس (`sentiment_label`). */
  @IsOptional()
  @IsString()
  sentimentLabel?: string;

  /** جستجوی متنی روی کپشن. */
  @IsOptional()
  @IsString()
  search?: string;

  /** ابتدای بازهٔ زمانی انتشار (شامل) — ISO-8601. */
  @IsOptional()
  @IsString()
  dateFrom?: string;

  /** انتهای بازهٔ زمانی انتشار (شامل) — ISO-8601. */
  @IsOptional()
  @IsString()
  dateTo?: string;
}

/**
 * DTO ثبت زمینهٔ دستی (manual context) یک ContentItem (design §5.3 — Requirement 3.3).
 */
export class UpdateContextDto {
  @IsString()
  @MaxLength(5000)
  manualContext: string;
}

/**
 * Query محتوای پراثر (high-impact) (design §5.3 — Requirement 3.4).
 *
 * محتوا بر اساس معیار اثرگذاری (لایک + کامنت + اشتراک + بازدید) نزولی مرتب
 * می‌شود. فیلترهای اختیاری: منبع، پلتفرم، خوشه و بازهٔ زمانی (روز).
 */
export class HighImpactQuery {
  /** سقف تعداد نتایج (پیش‌فرض ۱۰، حداکثر ۱۰۰). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  /** فیلتر منبع (`source_id` → `page_id`). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceId?: number;

  /** فیلتر پلتفرم — join به `pages`. */
  @IsOptional()
  @IsIn(CONTENT_PLATFORMS)
  platform?: string;

  /** فیلتر خوشه — join به `pages.cluster_id`. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clusterId?: number;

  /** پنجرهٔ زمانی به روز (مثلاً ۷ = هفت روز اخیر). در صورت نبود، بدون محدودیت. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  days?: number;
}
