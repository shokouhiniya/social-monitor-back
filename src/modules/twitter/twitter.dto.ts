import { IsString, IsOptional, IsNumber } from 'class-validator';

export class SyncTwitterAccountDto {
  @IsString()
  username: string;
}

export class SearchTweetsDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  count?: number = 20;
}

export class MonitorAccountDto {
  @IsNumber()
  pageId: number;
}
