import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { PageService } from '../page/page.service';
import { PostService } from '../post/post.service';
import { StrategicAlert } from '../strategic-alert/strategic-alert.entity';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private lastRefreshedAt: Date | null = null;
  private cachedReport: any = null;
  private cachedAlerts: any = null;

  constructor(
    private readonly pageService: PageService,
    private readonly postService: PostService,
    private readonly settingsService: SettingsService,
    @InjectRepository(StrategicAlert)
    private alertRepository: Repository<StrategicAlert>,
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
    // If no topics provided, load defaults from settings
    if (!globalTopics || globalTopics.length === 0) {
      const topicsStr = await this.settingsService.get('silence_radar_topics');
      globalTopics = topicsStr
        ? topicsStr.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    }
    if (globalTopics.length === 0) {
      return { global_topics: [], covered_topics: [], silence_gaps: [], coverage_rate: 0 };
    }

    // Get topics from posts AND keywords (both sources)
    const [ourTopics, ourKeywords] = await Promise.all([
      this.postService.getTopicGravity(7),
      this.postService.getTrendingKeywords(7),
    ]);

    // Combine all network content into a single searchable set
    const networkTerms = new Set<string>();
    for (const t of ourTopics) networkTerms.add(t.topic.toLowerCase());
    for (const k of ourKeywords) networkTerms.add(k.keyword.toLowerCase());

    // Fuzzy match: a global topic is "covered" if any network term contains it or vice versa
    const covered: string[] = [];
    const gaps: string[] = [];

    for (const topic of globalTopics) {
      const topicLower = topic.toLowerCase();
      const isCovered = [...networkTerms].some(
        (term) => term.includes(topicLower) || topicLower.includes(term),
      );
      if (isCovered) {
        covered.push(topic);
      } else {
        gaps.push(topic);
      }
    }

    return {
      global_topics: globalTopics,
      covered_topics: covered,
      silence_gaps: gaps,
      coverage_rate: Math.round((covered.length / globalTopics.length) * 100),
    };
  }

  async getProfileDeepDive(pageId: number, timeRange?: string) {
    // Calculate date filter based on time range
    let dateFilter: Date | undefined = undefined;
    let hoursNeeded = 168; // Default to 1 week
    
    if (timeRange && timeRange !== 'all') {
      const hoursMap = {
        '24h': 24,
        '3d': 72,
        '1w': 168,
        '2w': 336,
        '1m': 720,
      };
      hoursNeeded = hoursMap[timeRange] || 168;
      dateFilter = new Date(Date.now() - hoursNeeded * 60 * 60 * 1000);
    }

    // Get page with posts
    const page = await this.pageService.findById(pageId);
    
    // Check if we have posts covering the requested timeframe
    if (dateFilter && page && page.posts && page.posts.length > 0) {
      const oldestPost = page.posts.reduce((oldest, post) => {
        const postDate = new Date(post.published_at || post.created_at);
        const oldestDate = new Date(oldest.published_at || oldest.created_at);
        return postDate < oldestDate ? post : oldest;
      });
      
      const oldestPostDate = new Date(oldestPost.published_at || oldestPost.created_at);
      const needsMorePosts = oldestPostDate > dateFilter;
      
      console.log(`📊 Time range check: Need posts from ${dateFilter.toISOString()}, oldest post is ${oldestPostDate.toISOString()}, needs more: ${needsMorePosts}`);
      
      if (needsMorePosts && (page.platform === 'twitter' || page.platform === 'telegram')) {
        console.log(`📥 Fetching more posts to cover the requested timeframe...`);
        try {
          if (page.platform === 'twitter') {
            await axios.post(`http://localhost:3000/twitter/fetch-more/${pageId}`, { count: 100 });
          } else if (page.platform === 'telegram') {
            await axios.post(`http://localhost:3000/telegram/fetch-more/${pageId}`, { messageLimit: 100 });
          }
          const updatedPage = await this.pageService.findById(pageId);
          Object.assign(page, updatedPage);
          console.log(`✅ Fetched more posts, now have ${page.posts?.length || 0} total posts`);
        } catch (error) {
          console.warn(`⚠️ Could not fetch more posts: ${error.message}`);
        }
      }
    }

    const [sentimentTimeline, contentHooks] = await Promise.all([
      this.postService.getSentimentTimeline(pageId, 30, dateFilter),
      this.postService.getContentHookAnalysis(pageId, dateFilter),
    ]);

    // Filter posts by date if needed
    if (page && page.posts && dateFilter) {
      page.posts = page.posts.filter(post => 
        post.published_at && new Date(post.published_at) >= dateFilter
      );
    }

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
      time_range: timeRange || 'all',
      posts_count: page.posts?.length || 0,
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

    const paragraphs: string[] = [];

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

  async getHighImpactPosts(limit = 5) {
    return await this.postService.getHighImpactPosts(limit);
  }

  async getNarrativeHealth() {
    const [keywords, topics, alignment] = await Promise.all([
      this.postService.getTrendingKeywords(7),
      this.postService.getTopicGravity(7),
      this.getAlignmentIndex(),
    ]);

    // Target narrative keywords from settings
    const targetNarrativeStr = await this.settingsService.get('target_narrative');
    const targetKeywords = targetNarrativeStr
      ? targetNarrativeStr.split(',').map((k) => k.trim()).filter(Boolean)
      : ['مقاومت', 'فلسطین', 'غزه', 'حقوق بشر', 'عدالت'];

    // Combine keywords and topics for broader matching
    const networkTerms = new Set<string>();
    for (const k of keywords) networkTerms.add(k.keyword.toLowerCase());
    for (const t of topics) networkTerms.add(t.topic.toLowerCase());

    // Fuzzy match: target keyword is "matched" if any network term contains it or vice versa
    const matchedTargets: string[] = [];
    const unmatchedTargets: string[] = [];
    for (const tk of targetKeywords) {
      const tkLower = tk.toLowerCase();
      const isMatched = [...networkTerms].some(
        (term) => term.includes(tkLower) || tkLower.includes(term),
      );
      if (isMatched) {
        matchedTargets.push(tk);
      } else {
        unmatchedTargets.push(tk);
      }
    }

    const narrativeScore = targetKeywords.length > 0
      ? Math.round((matchedTargets.length / targetKeywords.length) * 100)
      : 0;

    // Find deviation keywords (trending but not in target narrative)
    const deviationKeywords = keywords
      .filter((k) => !targetKeywords.some((tk) =>
        tk.toLowerCase().includes(k.keyword.toLowerCase()) || k.keyword.toLowerCase().includes(tk.toLowerCase()),
      ))
      .slice(0, 5)
      .map((k) => k.keyword);

    const label = narrativeScore > 70 ? 'انطباق بالا' : narrativeScore > 40 ? 'خنثی' : 'انحراف شدید';

    return {
      score: narrativeScore,
      label,
      target_keywords: targetKeywords,
      matched_keywords: matchedTargets,
      unmatched_keywords: unmatchedTargets,
      deviation_keywords: deviationKeywords,
      alignment_index: alignment.alignment_index,
      total_network_terms: networkTerms.size,
    };
  }

  async getCrisisCorridor() {
    const ghostPages = await this.pageService.getGhostPages();
    // Also get pages with very negative sentiment
    const allPages = await this.pageService.findAll({ page: 1, limit: 100 });
    const crisisPages = allPages.data.filter(
      (p) => !p.is_active || p.consistency_rate < 2 || p.credibility_score < 2,
    );
    return crisisPages.slice(0, 10);
  }

  async getAiSynthesizer() {
    const [keywords, topics, sentiment] = await Promise.all([
      this.postService.getTrendingKeywords(1),
      this.postService.getTopicGravity(1),
      this.postService.getSentimentTimeline(undefined, 1),
    ]);

    const topTopic = topics[0]?.topic || 'بدون موضوع خاص';
    const topKeyword = keywords[0]?.keyword || '';
    const avgSentiment = sentiment.length > 0
      ? sentiment.reduce((s, i) => s + Number(i.avg_sentiment || 0), 0) / sentiment.length
      : 0;

    const mood = avgSentiment > 0.2 ? 'امیدوار' : avgSentiment < -0.2 ? 'ملتهب' : 'در وضعیت انتظار';
    const headline = `امروز شبکه ${mood} است؛ تمرکز اصلی روی «${topTopic}» ${topKeyword ? `و «${topKeyword}»` : ''} قرار دارد.`;

    return {
      headline,
      mood,
      top_topic: topTopic,
      top_keyword: topKeyword,
      sentiment_score: avgSentiment,
    };
  }

  async getKeywordVelocity() {
    return await this.postService.getKeywordVelocity();
  }

  async getSentimentInfluenceMatrix() {
    return await this.postService.getSentimentInfluenceMatrix();
  }

  async getNarrativeBattle() {
    return await this.postService.getNarrativeBattle();
  }

  private async callLLM(prompt: string): Promise<string> {
    const [apiKey, model] = await Promise.all([
      this.settingsService.get('openrouter_key'),
      this.settingsService.get('llm_model'),
    ]);
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model || 'google/gemini-2.5-pro',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey || process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 90000,
      },
    );
    return response.data?.choices?.[0]?.message?.content || '';
  }

  // Cron: Run at 00:00, 06:00, 12:00, 18:00 Tehran time (UTC+3:30 → 20:30, 02:30, 08:30, 14:30 UTC)
  @Cron('30 20,2,8,14 * * *')
  async handleScheduledRefresh() {
    this.logger.log('Scheduled refresh triggered');
    await this.refreshDashboard();
  }

  async refreshDashboard() {
    try {
      const [report, alerts] = await Promise.all([
        this.generateReportWithLLM(),
        this.generateAlertsWithLLM(),
      ]);
      this.cachedReport = report;
      this.cachedAlerts = alerts;
      this.lastRefreshedAt = new Date();
      this.logger.log(`Dashboard refreshed at ${this.lastRefreshedAt.toISOString()}`);
      return { status: 'success', refreshed_at: this.lastRefreshedAt.toISOString(), report, alerts };
    } catch (error) {
      this.logger.error(`Refresh failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  getRefreshStatus() {
    return {
      last_refreshed_at: this.lastRefreshedAt?.toISOString() || null,
      has_cached_report: !!this.cachedReport,
      has_cached_alerts: !!this.cachedAlerts,
    };
  }

  async generateAlertsWithLLM() {
    // Gather all data
    const pages = await this.pageService.findAll({ page: 1, limit: 100 });
    const keywords = await this.postService.getTrendingKeywords(7);
    const topics = await this.postService.getTopicGravity(7);

    const pagesInfo = pages.data.slice(0, 30).map((p) =>
      `${p.name} (@${p.username}) — دسته: ${p.category || '?'}, نفوذ: ${p.influence_score}, اعتبار: ${p.credibility_score}, پایداری: ${p.consistency_rate}, فعال: ${p.is_active}`
    ).join('\n');

    const topicsInfo = topics.slice(0, 10).map((t) => `${t.topic}: ${t.count} پست`).join(', ');
    const kwInfo = keywords.slice(0, 10).map((k) => `${k.keyword}: ${k.count}`).join(', ');

    // Load system prompt and extra instructions from settings
    const [systemPrompt, extraInstructions] = await Promise.all([
      this.settingsService.get('prompt_alert_generation'),
      this.settingsService.get('prompt_alert_generation_extra'),
    ]);

    const prompt = `${systemPrompt || 'تو یک تحلیل‌گر استراتژیک رسانه‌ای هستی. بر اساس دیتای زیر، ۵ هشدار استراتژیک تولید کن.'}

پیج‌ها:
${pagesInfo}

موضوعات داغ: ${topicsInfo}
کلمات کلیدی: ${kwInfo}
${extraInstructions ? `\nدستورات اضافی:\n${extraInstructions}\n` : ''}
خروجی را دقیقاً به فرمت JSON array زیر برگردان (بدون متن اضافه):
[
  {
    "title": "عنوان هشدار",
    "message": "توضیح مفصل هشدار (حداقل ۲ جمله)",
    "priority": "critical/high/medium/low",
    "category": "silence_gap/trend_shift/crisis/opportunity",
    "playbook": ["اقدام ۱", "اقدام ۲", "اقدام ۳"]
  }
]`;

    try {
      const content = await this.callLLM(prompt);
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return { status: 'error', message: 'LLM did not return valid JSON' };

      const alerts = JSON.parse(jsonMatch[0]);

      // Save alerts
      const saved: StrategicAlert[] = [];
      for (const a of alerts) {
        const alert = this.alertRepository.create({
          title: a.title,
          message: a.message,
          priority: a.priority || 'medium',
          category: a.category || 'other',
          playbook: a.playbook || [],
          status: 'active',
          created_by: 1,
          group_key: a.category,
        });
        saved.push(await this.alertRepository.save(alert));
      }

      return { status: 'success', message: `${saved.length} هشدار استراتژیک تولید شد`, alerts: saved };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async generateReportWithLLM() {
    const pages = await this.pageService.findAll({ page: 1, limit: 50 });
    const keywords = await this.postService.getTrendingKeywords(7);
    const topics = await this.postService.getTopicGravity(7);
    const sentiment = await this.postService.getSentimentTimeline(undefined, 7);

    const pagesInfo = pages.data.slice(0, 20).map((p) =>
      `${p.name}: نفوذ ${p.influence_score}, اعتبار ${p.credibility_score}, دسته ${p.category}`
    ).join('\n');

    const topicsInfo = topics.slice(0, 8).map((t) => `${t.topic} (${t.count} پست)`).join(', ');
    const kwInfo = keywords.slice(0, 10).map((k) => k.keyword).join(', ');
    const avgSentiment = sentiment.length > 0
      ? (sentiment.reduce((s, i) => s + Number(i.avg_sentiment || 0), 0) / sentiment.length).toFixed(2)
      : '0';

    // Load system prompt and extra instructions from settings
    const [systemPrompt, extraInstructions] = await Promise.all([
      this.settingsService.get('prompt_report_generation'),
      this.settingsService.get('prompt_report_generation_extra'),
    ]);

    const prompt = `${systemPrompt || 'تو یک تحلیل‌گر ارشد رسانه‌ای هستی. بر اساس دیتای زیر، یک گزارش تحلیلی جامع بنویس.'}

پیج‌های شبکه:
${pagesInfo}

موضوعات داغ: ${topicsInfo}
کلمات کلیدی: ${kwInfo}
میانگین احساسات: ${avgSentiment}
${extraInstructions ? `\nدستورات اضافی:\n${extraInstructions}\n` : ''}
خروجی را به فرمت JSON زیر برگردان:
{
  "headline": "تیتر یک شبکه (یک جمله کوتاه و تاثیرگذار)",
  "report": "گزارش مفصل (حداقل ۵ پاراگراف شامل: وضعیت کلی شبکه، موضوعات داغ، تحلیل احساسات، نقاط قوت و ضعف، پیشنهادات عملیاتی)",
  "mood": "امیدوار/ملتهب/در وضعیت انتظار",
  "top_topics": ["موضوع۱", "موضوع۲", "موضوع۳"],
  "top_keywords": ["کلمه۱", "کلمه۲", "کلمه۳"]
}`;

    try {
      const content = await this.callLLM(prompt);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { status: 'error', message: 'LLM did not return valid JSON' };

      const report = JSON.parse(jsonMatch[0]);
      return { status: 'success', ...report, generated_at: new Date().toISOString() };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}
