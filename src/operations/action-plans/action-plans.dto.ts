import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { ACTION_PLAN_STATUSES } from './action-plan.state-machine';

/**
 * DTO های زیرماژول action-plans (OperationsModule — design §5.10).
 */

/**
 * Query فهرست برنامه‌های عملیاتی (Requirement 9.5). صفحه‌بندی مشترک را به ارث
 * می‌برد و فیلترهای اختیاری وضعیت/مسئول/منبع/خوشه را اضافه می‌کند.
 */
export class ActionPlanListQuery extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ACTION_PLAN_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clusterId?: number;
}

/**
 * DTO ساخت ActionPlan (Requirement 9.4). وضعیت اولیه توسط سرویس تنظیم می‌شود.
 * مطابق منطق legacy، یکی از `page_id` یا `cluster_id` باید مشخص شود (در سرویس
 * بررسی می‌گردد).
 */
export class CreateActionPlanDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cluster_id?: number;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  alert_id?: number;

  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @IsString()
  suggested_content?: string;

  @IsOptional()
  @IsString()
  suggested_tone?: string;

  @IsOptional()
  due_date?: Date;

  @IsOptional()
  @IsObject()
  contact_info?: {
    phone?: string;
    email?: string;
    telegram?: string;
    notes?: string;
  };

  @IsOptional()
  @IsArray()
  recommended_pages?: number[];
}

/**
 * DTO گذار وضعیت ActionPlan (Requirement 9.2-9.3). `to` باید یکی از وضعیت‌های
 * معتبر باشد؛ مجاز بودن خودِ گذار توسط ماشین وضعیت در سرویس بررسی می‌شود.
 */
export class TransitionActionPlanDto {
  @IsNotEmpty()
  @IsIn(ACTION_PLAN_STATUSES as unknown as string[])
  to: string;
}
