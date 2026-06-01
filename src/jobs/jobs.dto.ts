import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';
import { JOB_STATUSES } from './job-state-machine';
import { JOB_TASK_TYPES, JobTaskType } from './jobs.types';

/**
 * DTO های JobsModule (design §5.11، Requirement 10.1).
 */

/**
 * DTO ساخت یک Job بروزرسانی (Requirement 10.1).
 *
 *  - `sourceIds` : فهرست شناسهٔ منابعی که بروزرسانی می‌شوند (حداقل یک عضو).
 *  - `steps`     : مراحل اجرا به‌ترتیب؛ هر منبع × هر مرحله یک `JobTask` می‌سازد.
 *                  در صورت ارائه‌نشدن، مقدار پیش‌فرض در سرویس اعمال می‌شود.
 */
export class RefreshJobDto {
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  sourceIds: number[];

  @IsOptional()
  @IsArray()
  @IsIn(JOB_TASK_TYPES as unknown as string[], { each: true })
  steps?: JobTaskType[];
}

/**
 * Query فهرست Job ها (`listJobs`). صفحه‌بندی مشترک را به ارث می‌برد و فیلتر اختیاری
 * وضعیت/نوع را اضافه می‌کند (Requirement 12.5-12.7).
 */
export class JobQuery extends PaginationQueryDto {
  @IsOptional()
  @IsIn(JOB_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  type?: string;
}
