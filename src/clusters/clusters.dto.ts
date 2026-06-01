import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTOهای ClustersModule (design §5.4).
 *
 * این DTOها هم‌سطح با نسخهٔ legacy (`modules/cluster/cluster.dto.ts`) هستند اما
 * با محدودیت‌های اعتبارسنجی صریح‌تر (طول رشته) تا با ValidationPipe سراسری
 * (`whitelist: true`) سازگار باشند.
 */

/** DTO ساخت یک خوشهٔ جدید (Requirement 1.1 — CRUD). */
export class CreateClusterDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  icon?: string;
}

/** DTO به‌روزرسانی یک خوشهٔ موجود (partial update). */
export class UpdateClusterDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  icon?: string;
}

/** DTO افزودن/حذف منابع به/از یک خوشه. */
export class AssignSourcesDto {
  @IsArray()
  @IsInt({ each: true })
  source_ids: number[];
}

/** DTO تعیین مجموعهٔ کامل نمایندگان یک خوشه. */
export class SetRepresentativesDto {
  @IsArray()
  @IsInt({ each: true })
  source_ids: number[];
}

/** DTO تغییر پرچم نماینده برای یک منبع درون یک خوشه. */
export class ToggleRepresentativeDto {
  @IsBoolean()
  is_representative: boolean;
}
