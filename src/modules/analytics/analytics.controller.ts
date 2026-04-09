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

  @Get('reaction-velocity')
  getReactionVelocity(@Query('days') days: number) {
    return this.analyticsService.getReactionVelocity(days);
  }

  @Get('network-pulse')
  getNetworkPulse() {
    return this.analyticsService.getNetworkPulse();
  }

  @Get('ghost-pages')
  getGhostPages() {
    return this.analyticsService.getGhostPages();
  }

  @Get('periodic-report')
  getPeriodicReport() {
    return this.analyticsService.getPeriodicReport();
  }

  @Get('latest-posts')
  getLatestPosts(@Query('limit') limit: number) {
    return this.analyticsService.getLatestPosts(limit || 10);
  }
}
