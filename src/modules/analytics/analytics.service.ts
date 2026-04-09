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
        this.postService.getTrendingKeywords(30),
        this.postService.getTopicGravity(30),
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
    const keywords = await this.postService.getTrendingKeywords(30);
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

  async getPeriodicReport() {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const [keywords, topics, sentiment, reshares, categories, ghostPages] = await Promise.all([
      this.postService.getTrendingKeywords(1),
      this.postService.getTopicGravity(1),
      this.postService.getSentimentTimeline(undefined, 1),
      this.postService.getReshareTree(1),
      this.pageService.getCategoryDistribution(),
      this.pageService.getGhostPages(),
    ]);

    const topKeywords = keywords.slice(0, 8).map((k) => k.keyword);
    const topTopics = topics.slice(0, 5).map((t) => t.topic);
    const topReshares = reshares.slice(0, 3).map((r) => r.source);
    const avgSentiment = sentiment.length > 0
      ? sentiment.reduce((s, i) => s + Number(i.avg_sentiment || 0), 0) / sentiment.length
      : 0;
    const totalPosts = sentiment.reduce((s, i) => s + Number(i.post_count || 0), 0);
    const totalPages = categories.reduce((s, i) => s + Number(i.count), 0);

    const sentimentLabel = avgSentiment > 0.2 ? 'امیدوار' : avgSentiment < -0.2 ? 'خشمگین' : 'خنثی';

    const paragraphs = [];

    paragraphs.push(`در بازه ۶ ساعت اخیر (${sixHoursAgo.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} تا ${now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}), مجموعاً ${totalPosts} پست از ${totalPages} پیج تحت پایش ثبت شده است.`);

    if (topTopics.length > 0) {
      paragraphs.push(`موضوعات داغ شبکه شامل «${topTopics.join('»، «')}» بوده و بیشترین حجم محتوا حول محور «${topTopics[0]}» تولید شده است.`);
    }

    paragraphs.push(`لحن غالب شبکه در این بازه ${sentimentLabel} ارزیابی می‌شود (امتیاز: ${avgSentiment.toFixed(2)} از ۱). ${avgSentiment < -0.2 ? 'فضای شبکه تنش‌زا است و توصیه می‌شود محتوای امیدبخش و مثبت در اولویت انتشار قرار گیرد.' : avgSentiment > 0.2 ? 'فضای شبکه مثبت و امیدوارکننده است. فرصت مناسبی برای تقویت روایت‌های سازنده وجود دارد.' : 'فضای شبکه نسبتاً خنثی است. می‌توان با محتوای هدفمند، لحن شبکه را به سمت مطلوب هدایت کرد.'}`);

    if (topReshares.length > 0) {
      paragraphs.push(`بیشترین بازنشر از پیج‌های «${topReshares.join('»، «')}» صورت گرفته که نشان‌دهنده نقش محوری آن‌ها در انتشار روایت است.`);
    }

    if (ghostPages.length > 0) {
      paragraphs.push(`${ghostPages.length} پیج در وضعیت «Ghost» (کم‌فعالیت یا غیرفعال) شناسایی شده‌اند که نیاز به بررسی و احتمالاً جایگزینی دارند.`);
    }

    paragraphs.push(`پیشنهاد عملیاتی: ${avgSentiment < 0 ? 'تمرکز بر تولید محتوای امیدبخش و انسانی. از انتشار محتوای تنش‌زا خودداری شود.' : 'ادامه روند فعلی با تاکید بر موضوعات ترند. فرصت مناسب برای تزریق محتوای استراتژیک.'}`);

    return {
      report: paragraphs.join(' '),
      generated_at: now.toISOString(),
      period_start: sixHoursAgo.toISOString(),
      period_end: now.toISOString(),
      top_keywords: topKeywords,
      top_topics: topTopics,
      avg_sentiment: avgSentiment,
      sentiment_label: sentimentLabel,
      total_posts: totalPosts,
      total_pages: totalPages,
      ghost_count: ghostPages.length,
    };
  }

  async getLatestPosts(limit = 10) {
    const result = await this.postService.findAll({ page: 1, limit });
    return result.data;
  }
}
