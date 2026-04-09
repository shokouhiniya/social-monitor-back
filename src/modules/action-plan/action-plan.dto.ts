import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateActionPlanDto {
  @IsNotEmpty()
  @IsNumber()
  page_id: number;

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
}
