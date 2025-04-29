import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHello(): string {
    const appName: string | undefined = this.configService.get('appName');
    return `Welcome to ${appName} api`;
  }
}
