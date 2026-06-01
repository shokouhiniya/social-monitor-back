import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

/**
 * DTO های زیرماژول field-reports (OperationsModule — design §5.10).
 *
 * FieldReport گردش‌کار وضعیتِ گذارمحور مثل Alert/ActionPlan ندارد؛ تنها
 * `list`/`create` ارائه می‌شود و رکورد با وضعیت اولیهٔ معتبر `pending` ذخیره
 * می‌شود (Requirement 9.4, 9.5).
 */

/** Query فهرست گزارش‌های میدانی (Requirement 9.5) با فیلترهای اختیاری. */
export class FieldReportListQuery extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceId?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

/** DTO ساخت FieldReport (Requirement 9.4). */
export class CreateFieldReportDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page_id?: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  reporter_id: number;

  @IsNotEmpty()
  @IsString()
  content: string;

  /** منبع گزارش: voice, file, manual */
  @IsOptional()
  @IsString()
  source_type?: string;

  @IsOptional()
  @IsString()
  file_url?: string;

  @IsOptional()
  @IsArray()
  extracted_keywords?: string[];

  @IsOptional()
  @IsString()
  sentiment?: string;

  @IsOptional()
  @IsBoolean()
  is_override?: boolean;

  @IsOptional()
  @IsString()
  override_note?: string;
}
