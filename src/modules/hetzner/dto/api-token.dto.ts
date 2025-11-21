import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ApiTokenDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'API token must be at least 10 characters long' })
  token: string;
}
