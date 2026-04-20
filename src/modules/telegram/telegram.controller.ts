import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('sync')
  async syncChannel(
    @Body('username') username: string,
    @Body('messageLimit') messageLimit: number = 50,
    @Body('page_category') pageCategory?: string,
    @Body('client_keywords') clientKeywords?: string[],
  ) {
    if (!username) {
      return { error: 'Username is required' };
    }
    return await this.telegramService.syncTelegramChannel(username, messageLimit, pageCategory, clientKeywords);
  }

  @Post('fetch-more/:pageId')
  async fetchMoreMessages(
    @Param('pageId') pageId: number,
    @Body('messageLimit') messageLimit: number = 50,
  ) {
    return await this.telegramService.fetchMoreMessages(pageId, messageLimit);
  }

  @Post('monitor/:pageId')
  async monitorChannel(@Param('pageId') pageId: number) {
    return await this.telegramService.monitorChannel(pageId);
  }
}
