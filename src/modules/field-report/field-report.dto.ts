import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFieldReportDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page_id?: number;

  @IsNotEmpty()
  @IsNumber()
  reporter_id: number;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  source_type?: string;

  @IsOptional()
  @IsString()
  file_url?: string;

  @IsOptional()
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

export class FieldReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page_id?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
