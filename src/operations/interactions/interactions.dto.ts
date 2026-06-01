import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

/**
 * DTO های زیرماژول interactions (OperationsModule — design §5.10).
 *
 * Interaction گردش‌کار وضعیت ندارد (بدون `transition`)؛ تنها `list`/`create`
 * ارائه می‌شود (Requirement 9.4, 9.5).
 */

/** Query فهرست تعاملات (Requirement 9.5) با فیلترهای اختیاری. */
export class InteractionListQuery extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actionPlanId?: number;
}

/** DTO ساخت Interaction (Requirement 9.4). */
export class CreateInteractionDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  page_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  action_plan_id?: number;

  /** نوع تعامل: direct, phone, meeting, email, comment */
  @IsNotEmpty()
  @IsString()
  type: string;

  /** نتیجه: success, failed */
  @IsNotEmpty()
  @IsString()
  result: string;

  @IsNotEmpty()
  @IsString()
  responsible: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
