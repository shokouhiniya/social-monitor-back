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

  @Get('high-impact-posts')
  getHighImpactPosts(@Query('limit') limit: number) {
    return this.analyticsService.getHighImpactPosts(limit || 5);
  }

  @Get('narrative-health')
  getNarrativeHealth() {
    return this.analyticsService.getNarrativeHealth();
  }

  @Get('crisis-corridor')
  getCrisisCorridor() {
    return this.analyticsService.getCrisisCorridor();
  }

  @Get('ai-synthesizer')
  getAiSynthesizer() {
    return this.analyticsService.getAiSynthesizer();
  }

  @Get('keyword-velocity')
  getKeywordVelocity() {
    return this.analyticsService.getKeywordVelocity();
  }

  @Get('sentiment-influence-matrix')
  getSentimentInfluenceMatrix() {
    return this.analyticsService.getSentimentInfluenceMatrix();
  }

  @Get('narrative-battle')
  getNarrativeBattle() {
    return this.analyticsService.getNarrativeBattle();
  }

  @Post('generate-alerts')
  generateAlerts() {
    return this.analyticsService.generateAlertsWithLLM();
  }

  @Post('generate-report')
  generateReport() {
    return this.analyticsService.generateReportWithLLM();
  }

  @Post('refresh')
  refreshDashboard() {
    return this.analyticsService.refreshDashboard();
  }

  @Get('refresh-status')
  getRefreshStatus() {
    return this.analyticsService.getRefreshStatus();
  }
}
