import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';

/** DTO ساخت تسک. حداقل یکی از contextها باید باشد (اعتبارسنجی در سرویس). */
export class CreateTaskDto {
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @Type(() => Number) @IsInt() assignee_user_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() created_by_user_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() hub_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() micro_media_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() cluster_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() operation_id?: number;
  @IsOptional() @IsString() due_date?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/** DTO به‌روزرسانی تسک (partial). */
export class UpdateTaskDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @Type(() => Number) @IsInt() assignee_user_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() hub_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() micro_media_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() cluster_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() operation_id?: number;
  @IsOptional() @IsString() due_date?: string;
}

/** DTO تغییر وضعیت تسک. */
export class ChangeTaskStatusDto {
  @IsString() status: string; // open | in_progress | done | cancelled
}

/** Query فهرست تسک‌ها با فیلترها. */
export class TaskListQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @Type(() => Number) @IsInt() assigneeUserId?: number;
  @IsOptional() @Type(() => Number) @IsInt() hubId?: number;
  @IsOptional() @Type(() => Number) @IsInt() microMediaId?: number;
  @IsOptional() @Type(() => Number) @IsInt() operationId?: number;
  @IsOptional() @Type(() => Number) @IsInt() clusterId?: number;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsString() overdue?: string;
  @IsOptional() @IsString() dueBefore?: string;
  @IsOptional() @IsString() dueAfter?: string;
  @IsOptional() @IsString() search?: string;
}
