import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePageDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  identity_category?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  content_language?: string;

  @IsOptional()
  @IsString()
  religion?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  age_range?: string;

  @IsOptional()
  @IsNumber()
  followers_count?: number;

  @IsOptional()
  @IsNumber()
  following_count?: number;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profile_image_url?: string;

  @IsOptional()
  @IsString()
  cluster?: string;

  @IsOptional()
  keywords?: string[];

  @IsOptional()
  @IsString()
  page_category?: string;

  @IsOptional()
  client_keywords?: string[];
}

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  identity_category?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  content_language?: string;

  @IsOptional()
  @IsString()
  religion?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  age_range?: string;

  @IsOptional()
  @IsNumber()
  followers_count?: number;

  @IsOptional()
  @IsNumber()
  following_count?: number;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profile_image_url?: string;

  @IsOptional()
  @IsString()
  cluster?: string;

  @IsOptional()
  @IsNumber()
  cluster_id?: number | null;

  @IsOptional()
  @IsBoolean()
  is_representative?: boolean;

  @IsOptional()
  keywords?: string[];

  @IsOptional()
  persona_radar?: Record<string, number>;

  @IsOptional()
  pain_points?: string[];

  @IsOptional()
  @IsString()
  page_category?: string;

  @IsOptional()
  client_keywords?: string[];

  @IsOptional()
  @IsNumber()
  credibility_score?: number;

  @IsOptional()
  @IsNumber()
  influence_score?: number;

  @IsOptional()
  @IsNumber()
  consistency_rate?: number;

  @IsOptional()
  @IsNumber()
  affinity_score?: number;

  @IsOptional()
  @IsNumber()
  alignment_score?: number;
}

export class PageQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  identity_category?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  cluster?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cluster_id?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_representative?: boolean;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
