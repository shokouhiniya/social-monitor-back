import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, IsObject } from 'class-validator';

export class CreateActionPlanDto {
  // Either page_id or cluster_id must be set (one operation per page or cluster)
  @IsOptional()
  @IsNumber()
  page_id?: number;

  @IsOptional()
  @IsNumber()
  cluster_id?: number;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  due_date?: Date;

  @IsOptional()
  @IsNumber()
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

export class CreateActionPlanFromAlertDto {
  @IsNotEmpty()
  @IsNumber()
  alert_id: number;

  @IsOptional()
  @IsArray()
  page_ids?: number[];

  @IsOptional()
  @IsNumber()
  cluster_id?: number;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  due_date?: Date;

  @IsOptional()
  @IsString()
  assigned_to?: string;
}

export class UpdateActionPlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  due_date?: Date;

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
