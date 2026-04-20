import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TwitterService } from './twitter.service';

@Controller('twitter')
export class TwitterController {
  constructor(private readonly twitterService: TwitterService) {}

  @Post('sync')
  async syncAccount(
    @Body('username') username: string,
    @Body('page_category') pageCategory?: string,
    @Body('client_keywords') clientKeywords?: string[],
  ) {
    if (!username) {
      return { error: 'Username is required' };
    }
    return await this.twitterService.syncTwitterAccount(username, pageCategory, clientKeywords);
  }

  @Post('fetch-more/:pageId')
  async fetchMoreTweets(
    @Param('pageId') pageId: number,
    @Body('count') count: number = 50,
  ) {
    return await this.twitterService.fetchMoreTweets(pageId, count);
  }

  @Post('monitor/:pageId')
  async monitorAccount(@Param('pageId') pageId: number) {
    return await this.twitterService.monitorAccount(pageId);
  }

  @Get('profile/:username')
  async getProfile(@Param('username') username: string) {
    return await this.twitterService.fetchUserProfile(username);
  }

  @Get('tweets/:username')
  async getTweets(
    @Param('username') username: string,
    @Query('count') count: number = 20,
  ) {
    return await this.twitterService.fetchUserTweets(username, count);
  }

  @Get('search')
  async searchTweets(
    @Query('query') query: string,
    @Query('count') count: number = 20,
  ) {
    if (!query) {
      return { error: 'Query parameter is required' };
    }
    return await this.twitterService.searchTweets(query, count);
  }

  @Get('tweet/:id')
  async getTweetDetails(@Param('id') id: string) {
    return await this.twitterService.getTweetDetails(id);
  }
}
