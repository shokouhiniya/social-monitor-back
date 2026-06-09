import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';

/**
 * DTO ساخت یک حساب پلتفرمی (page) همزمان با ساخت میکرورسانه.
 * page بر اساس username/platform ساخته می‌شود و به میکرورسانه متصل می‌گردد.
 */
export class CreateInlineAccountDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsString() @MaxLength(255) username: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() profile_url?: string;
  @IsOptional() @Type(() => Number) @IsInt() followers_count?: number;
  @IsOptional() is_primary?: boolean;
}

/** DTO ساخت میکرورسانه. تنها `name` اجباری است؛ بقیه بعداً تکمیل می‌شوند. */
export class CreateMicroMediaDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional() @Type(() => Number) @IsInt() hub_id?: number;
  @IsOptional() @IsString() identity_title?: string;
  @IsOptional() @IsString() identity_description?: string;
  @IsOptional() @IsString() activity_domain?: string;
  @IsOptional() @IsString() contact_name?: string;
  @IsOptional() @IsString() contact_phone?: string;
  @IsOptional() @IsString() contact_email?: string;
  @IsOptional() @IsString() contact_notes?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() age_group?: string;
  @IsOptional() @Type(() => Number) @IsInt() topic_cluster_id?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() importance_level?: string;
  @IsOptional() @IsString() notes?: string;

  /** برچسب‌های اولیه (اختیاری). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** سکوها (حساب‌های پلتفرمی) که همزمان با میکرورسانه ساخته و متصل می‌شوند. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInlineAccountDto)
  accounts?: CreateInlineAccountDto[];
}

/** DTO به‌روزرسانی میکرورسانه (partial). */
export class UpdateMicroMediaDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() hub_id?: number;
  @IsOptional() @IsString() identity_title?: string;
  @IsOptional() @IsString() identity_description?: string;
  @IsOptional() @IsString() activity_domain?: string;
  @IsOptional() @IsString() contact_name?: string;
  @IsOptional() @IsString() contact_phone?: string;
  @IsOptional() @IsString() contact_email?: string;
  @IsOptional() @IsString() contact_notes?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() age_group?: string;
  @IsOptional() @Type(() => Number) @IsInt() topic_cluster_id?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() importance_level?: string;
  @IsOptional() @IsString() notes?: string;
}

/** Query فهرست میکرورسانه‌ها با فیلترها (design §6.5 plan). */
export class MicroMediaListQueryDto extends PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() hubId?: number;
  @IsOptional() @Type(() => Number) @IsInt() clusterId?: number;
  @IsOptional() @IsString() activityDomain?: string;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;

  /** اگر 'true'، فقط رسانه‌های دارای تعامل در بازهٔ اخیر (پیش‌فرض ۶ ماه). */
  @IsOptional() @IsString() hasRecentInteraction?: string;

  /** ISO date؛ فقط رسانه‌هایی که از این تاریخ به بعد تعامل نداشته‌اند. */
  @IsOptional() @IsString() noInteractionSince?: string;
}

/** DTO اتصال یک account/page موجود به میکرورسانه. */
export class AssignAccountDto {
  @Type(() => Number)
  @IsInt()
  page_id: number;

  @IsOptional()
  is_primary?: boolean;
}

/** DTO ثبت snapshot عملکردی دستی. */
export class CreatePerformanceSnapshotDto {
  @IsOptional() @Type(() => Number) @IsInt() page_id?: number;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @Type(() => Number) @IsInt() followers?: number;
  @IsOptional() @Type(() => Number) @IsInt() views?: number;
  @IsOptional() @Type(() => Number) @IsInt() likes?: number;
  @IsOptional() @Type(() => Number) @IsInt() comments?: number;
  @IsOptional() @Type(() => Number) @IsInt() shares?: number;
  @IsOptional() @Type(() => Number) @IsInt() posts_count?: number;
  @IsOptional() @Type(() => Number) @IsInt() content_count?: number;
  @IsOptional() @Type(() => Number) engagement_rate?: number;
  @IsOptional() @Type(() => Number) growth_rate?: number;
}
