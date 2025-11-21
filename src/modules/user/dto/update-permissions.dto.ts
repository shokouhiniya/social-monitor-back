import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePermissionsDto {
  @IsBoolean()
  @IsOptional()
  canManagePower?: boolean;

  @IsBoolean()
  @IsOptional()
  canAccessConsole?: boolean;

  @IsBoolean()
  @IsOptional()
  canViewMetrics?: boolean;

  @IsBoolean()
  @IsOptional()
  canViewDetails?: boolean;
}
