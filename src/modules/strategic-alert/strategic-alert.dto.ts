import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateStrategicAlertDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  target_pages?: number[];

  @IsNotEmpty()
  @IsNumber()
  created_by: number;

  @IsOptional()
  @IsString()
  assigned_to?: string;

  @IsOptional()
  @IsString()
  evidence_url?: string;

  @IsOptional()
  @IsString()
  group_key?: string;

  @IsOptional()
  playbook?: string[];

  @IsOptional()
  expires_at?: Date;
}

export class UpdateAlertStatusDto {
  @IsNotEmpty()
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  assigned_to?: string;
}
