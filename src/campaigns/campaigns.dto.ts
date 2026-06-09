import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';

/** DTO ساخت عملیات/کمپین. */
export class CreateOperationDto {
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsString() goal?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() owner_user_id?: number;
  @IsOptional() @IsString() starts_at?: string;
  @IsOptional() @IsString() ends_at?: string;
}

/** DTO به‌روزرسانی عملیات (partial). */
export class UpdateOperationDto {
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() goal?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() owner_user_id?: number;
  @IsOptional() @IsString() starts_at?: string;
  @IsOptional() @IsString() ends_at?: string;
}

/** Query فهرست عملیات‌ها. */
export class OperationListQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() ownerUserId?: number;
  @IsOptional() @IsString() search?: string;
}

/** DTO افزودن میکرورسانه‌ها به عملیات (تک یا چندتایی). */
export class AddMediaToOperationDto {
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  micro_media_ids: number[];

  @IsOptional() @IsString() planned_action?: string;
  @IsOptional() @IsString() expected_output?: string;
}

/** DTO ساخت تسک برای عملیات (روی همهٔ media یا یک media مشخص). */
export class CreateOperationTaskDto {
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @Type(() => Number) @IsInt() assignee_user_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() micro_media_id?: number;
  @IsOptional() @IsString() due_date?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

/** DTO ثبت خروجی عملیات. */
export class CreateOperationOutputDto {
  @IsOptional() @Type(() => Number) @IsInt() micro_media_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() page_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() task_id?: number;
  @IsOptional() @IsString() output_type?: string;
  @IsOptional() @IsString() output_url?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() published_at?: string;
  @IsOptional() @Type(() => Number) @IsInt() views?: number;
  @IsOptional() @Type(() => Number) @IsInt() likes?: number;
  @IsOptional() @Type(() => Number) @IsInt() comments?: number;
  @IsOptional() @Type(() => Number) @IsInt() shares?: number;
  @IsOptional() @Type(() => Number) engagement?: number;
  @IsOptional() @Type(() => Number) @IsInt() created_by_user_id?: number;
}
