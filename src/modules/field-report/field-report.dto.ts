import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class CreateFieldReportDto {
  @IsOptional()
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
  @IsNumber()
  page_id?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
