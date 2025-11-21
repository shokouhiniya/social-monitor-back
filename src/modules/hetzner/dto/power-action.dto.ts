import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export enum PowerAction {
  POWER_ON = 'poweron',
  POWER_OFF = 'poweroff',
  REBOOT = 'reboot',
}

export class PowerActionDto {
  @IsString()
  @IsNotEmpty()
  serverId: string;

  @IsEnum(PowerAction)
  action: PowerAction;
}
