import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('macro-dashboard')
  getMacroDashboard() {
    return this.analyticsService.getMacroDashboard();
  }

  @Get('alignment-index')
  getAlignmentIndex() {
    return this.analyticsService.getAlignmentIndex();
  }

  @Post('silence-radar')
  getSilenceRadar(@Body('global_topics') globalTopics: string[]) {
    return this.analyticsService.getSilenceRadar(globalTopics);
  }

  @Get('profile/:pageId')
  getProfileDeepDive(@Param('pageId') pageId: number) {
    return this.analyticsService.getProfileDeepDive(pageId);
  }
}
