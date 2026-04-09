import { Injectable } from '@nestjs/common';
import { PageService } from '../page/page.service';
import { PostService } from '../post/post.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly pageService: PageService,
    private readonly postService: PostService,
  ) {}

  async getMacroDashboard() {
    const [categories, clusters, countries, topInfluencers, trendingKeywords, topicGravity] =
      await Promise.all([
        this.pageService.getCategoryDistribution(),
        this.pageService.getClusterDistribution(),
        this.pageService.getCountryDistribution(),
        this.pageService.getTopInfluencers(10),
        this.postService.getTrendingKeywords(7),
        this.postService.getTopicGravity(7),
      ]);

    return {
      identity_distribution: categories,
      cluster_distribution: clusters,
      geo_distribution: countries,
      top_influencers: topInfluencers,
      trending_keywords: trendingKeywords,
      topic_gravity: topicGravity,
    };
  }

  async getAlignmentIndex() {
    // Measures how much the 2000 pages are saying the same thing
    const keywords = await this.postService.getTrendingKeywords(7);
    const total = keywords.reduce((sum, k) => sum + k.count, 0);
    const top5 = keywords.slice(0, 5).reduce((sum, k) => sum + k.count, 0);
    const alignment = total > 0 ? top5 / total : 0;

    return {
      alignment_index: Math.round(alignment * 100),
      top_keywords: keywords.slice(0, 5),
      description: alignment > 0.5
        ? 'شبکه در حال هم‌گرایی بالا است'
        : 'شبکه پراکنده و متنوع عمل می‌کند',
    };
  }

  async getSilenceRadar(globalTopics: string[]) {
    // Compare global hot topics with what our network covers
    const ourTopics = await this.postService.getTopicGravity(7);
    const ourTopicNames = ourTopics.map((t) => t.topic.toLowerCase());

    const gaps = globalTopics.filter(
      (topic) => !ourTopicNames.includes(topic.toLowerCase()),
    );

    const covered = globalTopics.filter((topic) =>
      ourTopicNames.includes(topic.toLowerCase()),
    );

    return {
      global_topics: globalTopics,
      covered_topics: covered,
      silence_gaps: gaps,
      coverage_rate: Math.round((covered.length / globalTopics.length) * 100),
    };
  }

  async getProfileDeepDive(pageId: number) {
    const [page, sentimentTimeline, contentHooks] = await Promise.all([
      this.pageService.findById(pageId),
      this.postService.getSentimentTimeline(pageId, 30),
      this.postService.getContentHookAnalysis(pageId),
    ]);

    return {
      page,
      persona_radar: page.persona_radar,
      pain_points: page.pain_points,
      credibility_score: page.credibility_score,
      influence_score: page.influence_score,
      consistency_rate: page.consistency_rate,
      sentiment_timeline: sentimentTimeline,
      keywords: page.keywords,
      content_hooks: contentHooks,
    };
  }

  async getReactionVelocity(days = 7) {
    // Measures how fast the network reacts to breaking news
    return await this.postService.getReactionVelocity(days);
  }

  async getNetworkPulse() {
    // Real-time activity level of the entire network
    return await this.postService.getNetworkPulse();
  }

  async getGhostPages() {
    // Pages with very low activity or content deletion patterns
    return await this.pageService.getGhostPages();
  }
}
