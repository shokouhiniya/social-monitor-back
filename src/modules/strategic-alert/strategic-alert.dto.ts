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
  expires_at?: Date;
}
