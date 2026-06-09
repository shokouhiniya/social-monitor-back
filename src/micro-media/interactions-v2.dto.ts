import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';

/**
 * انواع تعامل اولیه (design §3.6): call, meeting, message, service, operation,
 * follow_up, other. به‌صورت رشتهٔ آزاد نگه داشته می‌شود تا قابل توسعه باشد.
 */
export class CreateInteractionV2Dto {
  @Type(() => Number)
  @IsInt()
  micro_media_id: number;

  @IsString()
  @MaxLength(64)
  interaction_type: string;

  /** ISO date؛ اگر ندهند، زمان فعلی استفاده می‌شود. */
  @IsOptional() @IsString() interaction_date?: string;

  @IsOptional() @Type(() => Number) @IsInt() hub_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() operation_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() task_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() owner_user_id?: number;

  @IsOptional() @IsString() @MaxLength(5000) summary?: string;
  @IsOptional() @IsString() @MaxLength(255) result?: string;
  @IsOptional() @IsString() @MaxLength(5000) next_action?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/** Query فهرست تعاملات جدید با فیلترها. */
export class InteractionV2ListQuery extends PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() microMediaId?: number;
  @IsOptional() @Type(() => Number) @IsInt() hubId?: number;
  @IsOptional() @Type(() => Number) @IsInt() operationId?: number;
  @IsOptional() @Type(() => Number) @IsInt() taskId?: number;
  @IsOptional() @IsString() type?: string;
}
