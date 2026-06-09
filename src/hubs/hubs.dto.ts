import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** DTO ساخت هاب. */
export class CreateHubDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  manager_user_id?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/** DTO به‌روزرسانی هاب (partial). */
export class UpdateHubDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  manager_user_id?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/** DTO تخصیص کاربر به هاب با نقش درون‌هابی. */
export class AssignHubUserDto {
  @Type(() => Number)
  @IsInt()
  user_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  role_in_hub?: string;
}
