import { IsString, IsNotEmpty, IsInt } from 'class-validator';

export class AssignServerDto {
  @IsString()
  @IsNotEmpty()
  serverId: string;

  @IsInt()
  @IsNotEmpty()
  userId: number;
}
