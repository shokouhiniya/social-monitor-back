import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('macro-dashboard')
  getMacroDashboard(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getMacroDashboard(scope, clusterId ? Number(clusterId) : undefined);
  }

  @Get('alignment-index')
  getAlignmentIndex(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getAlignmentIndex(scope, clusterId ? Number(clusterId) : undefined);
  }

  @Post('silence-radar')
  getSilenceRadar(
    @Body('global_topics') globalTopics: string[],
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getSilenceRadar(
      globalTopics,
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Post('silence-radar/page/:pageId')
  getPageSilenceRadar(
    @Param('pageId') pageId: number,
    @Body('global_topics') globalTopics: string[],
    @Body('days') days?: number,
  ) {
    return this.analyticsService.getPageSilenceRadar(
      Number(pageId),
      globalTopics,
      days ? Number(days) : 30,
    );
  }

  @Get('profile/:pageId')
  getProfileDeepDive(
    @Param('pageId') pageId: number,
    @Query('timeRange') timeRange?: string,
  ) {
    return this.analyticsService.getProfileDeepDive(pageId, timeRange);
  }

  @Get('reaction-velocity')
  getReactionVelocity(
    @Query('days') days: number,
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getReactionVelocity(
      days,
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('network-pulse')
  getNetworkPulse(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getNetworkPulse(scope, clusterId ? Number(clusterId) : undefined);
  }

  @Get('network-pulse-weekly')
  getNetworkPulseWeekly(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getNetworkPulseWeekly(
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('ghost-pages')
  getGhostPages(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getGhostPages(scope, clusterId ? Number(clusterId) : undefined);
  }

  @Get('activity-index')
  getActivityIndex(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getActivityIndex(scope, clusterId ? Number(clusterId) : undefined);
  }

  @Get('periodic-report')
  getPeriodicReport(
    @Query('hours') hours?: number,
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getPeriodicReport(
      hours ? Number(hours) : 6,
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('latest-posts')
  getLatestPosts(
    @Query('limit') limit: number,
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getLatestPosts(
      limit || 10,
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('high-impact-posts')
  getHighImpactPosts(
    @Query('limit') limit: number,
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getHighImpactPosts(
      limit || 5,
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('narrative-health')
  getNarrativeHealth(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getNarrativeHealth(
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('crisis-corridor')
  getCrisisCorridor(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getCrisisCorridor(
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('ai-synthesizer')
  getAiSynthesizer(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getAiSynthesizer(
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('keyword-velocity')
  getKeywordVelocity(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getKeywordVelocity(
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('sentiment-influence-matrix')
  getSentimentInfluenceMatrix(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getSentimentInfluenceMatrix(
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('narrative-battle')
  getNarrativeBattle(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getNarrativeBattle(
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Post('generate-alerts')
  generateAlerts() {
    return this.analyticsService.generateAlertsWithLLM();
  }

  @Post('generate-report')
  generateReport(@Body('hours') hours?: number) {
    return this.analyticsService.generateReportWithLLM(hours ? Number(hours) : 6);
  }

  @Post('refresh')
  refreshDashboard() {
    return this.analyticsService.refreshDashboard();
  }

  @Get('actors-scene-report')
  getActorsSceneReport(
    @Query('scope') scope?: string,
    @Query('clusterId') clusterId?: number,
  ) {
    return this.analyticsService.getActorsSceneReport(
      scope,
      clusterId ? Number(clusterId) : undefined,
    );
  }

  @Get('refresh-status')
  getRefreshStatus() {
    return this.analyticsService.getRefreshStatus();
  }
}
