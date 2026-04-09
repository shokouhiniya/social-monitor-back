import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePostDto {
  @IsNotEmpty()
  @IsNumber()
  page_id: number;

  @IsOptional()
  @IsString()
  external_id?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  post_type?: string;

  @IsOptional()
  @IsString()
  media_url?: string;

  @IsOptional()
  @IsNumber()
  likes_count?: number;

  @IsOptional()
  @IsNumber()
  comments_count?: number;

  @IsOptional()
  @IsNumber()
  shares_count?: number;

  @IsOptional()
  @IsNumber()
  views_count?: number;

  @IsOptional()
  @IsNumber()
  sentiment_score?: number;

  @IsOptional()
  @IsString()
  sentiment_label?: string;

  @IsOptional()
  extracted_keywords?: string[];

  @IsOptional()
  extracted_topics?: string[];

  @IsOptional()
  @IsBoolean()
  is_reshare?: boolean;

  @IsOptional()
  @IsString()
  original_source?: string;

  @IsOptional()
  published_at?: Date;
}

export class PostQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page_id?: number;

  @IsOptional()
  @IsString()
  sentiment_label?: string;

  @IsOptional()
  @IsString()
  post_type?: string;

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
