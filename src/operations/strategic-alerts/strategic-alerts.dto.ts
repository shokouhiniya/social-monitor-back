import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { ALERT_STATUSES } from './strategic-alert.state-machine';

/**
 * DTO های زیرماژول strategic-alerts (OperationsModule — design §5.10).
 */

/**
 * Query فهرست هشدارها (Requirement 9.5). صفحه‌بندی مشترک را به ارث می‌برد و
 * فیلترهای اختیاری وضعیت/اولویت/دسته را اضافه می‌کند.
 */
export class AlertListQuery extends PaginationQueryDto {
  /** فیلتر وضعیت — تنها وضعیت‌های معتبر ماشین وضعیت پذیرفته می‌شوند. */
  @IsOptional()
  @IsIn(ALERT_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

/**
 * DTO ساخت StrategicAlert (Requirement 9.4). وضعیت اولیه توسط سرویس تنظیم می‌شود
 * و در ورودی پذیرفته نمی‌شود تا ناوردای «وضعیت اولیهٔ معتبر» تضمین شود.
 */
export class CreateAlertDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  target_pages?: number[];

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  created_by: number;

  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @IsString()
  evidence_url?: string;

  @IsOptional()
  @IsString()
  group_key?: string;
}

/**
 * DTO گذار وضعیت StrategicAlert (Requirement 9.1-9.3). `to` باید یکی از وضعیت‌های
 * معتبر باشد؛ مجاز بودن خودِ گذار توسط ماشین وضعیت در سرویس بررسی می‌شود.
 */
export class TransitionAlertDto {
  @IsNotEmpty()
  @IsIn(ALERT_STATUSES as unknown as string[])
  to: string;

  /** یادداشت اختیاری مرتبط با گذار. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsString()
  assigned_to?: string;
}
