import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Image proxy endpoint to bypass CORS
  @Get('proxy-image')
  async proxyImage(@Query('url') url: string, @Res() res: Response) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const contentType = response.headers['content-type'];
      res.setHeader('Content-Type', contentType);
      res.send(Buffer.from(response.data));
    } catch (error) {
      res.status(404).send('Image not found');
    }
  }
}
