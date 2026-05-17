import { IsOptional, IsString, IsArray, IsNumber, IsBoolean } from 'class-validator';

export class CreateClusterDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateClusterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class AssignPagesDto {
  @IsArray()
  @IsNumber({}, { each: true })
  page_ids: number[];
}

export class SetRepresentativesDto {
  @IsArray()
  @IsNumber({}, { each: true })
  page_ids: number[];
}

export class TogglePageRepresentativeDto {
  @IsBoolean()
  is_representative: boolean;
}
