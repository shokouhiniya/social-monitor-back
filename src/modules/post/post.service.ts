import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Post } from './post.entity';
import { CreatePostDto, PostQueryDto } from './post.dto';
import { TranscriptionService } from '../transcription/transcription.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    private readonly transcriptionService: TranscriptionService,
    private readonly settingsService: SettingsService,
  ) {}

  async findAll(query: PostQueryDto) {
    const { page_id, sentiment_label, post_type, search, page = 1, limit = 20 } = query;
    const where: any = {};

    if (page_id) where.page_id = page_id;
    if (sentiment_label) where.sentiment_label = sentiment_label;
    if (post_type) where.post_type = post_type;
    if (search) where.caption = Like(`%${search}%`);

    const [data, total] = await this.postRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { published_at: 'DESC' },
      relations: ['page'],
    });

    return { data, total, page, limit };
  }

  async findById(id: number) {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['page'],
    });
    if (!post) throw new HttpException('Post not found', 404);
    return post;
  }

  async create(dto: CreatePostDto) {
    const post = this.postRepository.create(dto);
    return await this.postRepository.save(post);
  }

  async createBulk(dtos: CreatePostDto[]) {
    const posts = this.postRepository.create(dtos);
    return await this.postRepository.save(posts);
  }

  async updateManualContext(id: number, manualContext: string) {
    const post = await this.findById(id);
    post.manual_context = manualContext || null;
    return await this.postRepository.save(post);
  }

  /**
   * Process a single post: transcription (if video), OCR (if image), then LLM analysis.
   * Skips steps that have already been done.
   */
  async processSinglePost(id: number) {
    const post = await this.findById(id);
    const results: any = { transcription: null, ocr: null, analysis: null };

    // 1. Transcription (if video and not yet done)
    if (!post.is_transcribed && ['video', 'reel', 'story'].includes(post.post_type)) {
      try {
        const text = await this.transcriptionService.transcribePost(post);
        results.transcription = text ? 'done' : 'no_audio';
      } catch (err) {
        results.transcription = `error: ${err.message}`;
      }
    } else if (post.is_transcribed && post.transcription) {
      results.transcription = 'already_done';
    }

    // 2. OCR (if image and not yet done)
    if ((post.ocr_text === null || post.ocr_text === undefined) && post.media_url) {
      const mediaLower = (post.media_url || '').toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].some(ext => mediaLower.endsWith(ext));
      if (isImage) {
        try {
          const ocrText = await this.extractOcrText(post);
          if (ocrText) {
            post.ocr_text = ocrText;
            results.ocr = 'done';
          } else {
            post.ocr_text = '';
            results.ocr = 'no_text';
          }
          await this.postRepository.save(post);
        } catch (err) {
          results.ocr = `error: ${err.message}`;
        }
      }
    } else if (post.ocr_text) {
      results.ocr = 'already_done';
    }

    // 3. LLM analysis — sentiment, topics, keywords, translations
    const needsAnalysis = !post.sentiment_label
      || (post.transcription && !post.transcription_fa && !this.looksLikeFarsi(post.transcription))
      || (post.ocr_text && !post.ocr_text_fa && !this.looksLikeFarsi(post.ocr_text))
      || (post.caption && !post.caption_fa && !this.looksLikeFarsi(post.caption));

    if (needsAnalysis) {
      try {
        await this.analyzePostWithLLM(post);
        results.analysis = 'done';
      } catch (err) {
        results.analysis = `error: ${err.message}`;
      }
    } else {
      results.analysis = 'already_done';
    }

    // Re-fetch to return updated data
    const updated = await this.findById(id);
    return { post: updated, results };
  }

  private looksLikeFarsi(text: string): boolean {
    if (!text) return false;
    // Check if text contains Farsi/Arabic characters
    const farsiChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
    return farsiChars / text.length > 0.3;
  }

  private async extractOcrText(post: Post): Promise<string | null> {
    if (!post.media_url) return null;

    let filePath: string;
    if (post.media_url.startsWith('/static/')) {
      filePath = path.join(process.cwd(), 'public', post.media_url.replace('/static/', ''));
    } else {
      return null;
    }
    if (!fs.existsSync(filePath)) return null;

    const imageBytes = fs.readFileSync(filePath);
    if (imageBytes.length < 1000 || imageBytes.length > 2 * 1024 * 1024) return null;

    const base64 = imageBytes.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const [apiKey] = await Promise.all([
      this.settingsService.get('openrouter_key'),
    ]);

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        // Use Flash for OCR — faster, no reasoning overhead, excellent at text extraction
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Extract ALL visible text from this image exactly as written. Include every line of text overlays, captions, watermarks, subtitles, and any text in screenshots. Preserve line breaks. Return ONLY the extracted text, nothing else. If there is no text in the image, return exactly: NO_TEXT' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ]}],
        max_tokens: 2000,
        temperature: 0,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey || process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    const text = (response.data?.choices?.[0]?.message?.content || '').trim();
    if (!text || text === 'NO_TEXT' || text.length < 2) return null;
    return text;
  }

  private async analyzePostWithLLM(post: Post): Promise<void> {
    const [apiKey, model] = await Promise.all([
      this.settingsService.get('openrouter_key'),
      this.settingsService.get('llm_model'),
    ]);

    let contentDesc = `کپشن: "${(post.caption || '(بدون متن)').slice(0, 300)}"`;
    if (post.transcription) contentDesc += `\nرونوشت صوتی: "${post.transcription.slice(0, 500)}"`;
    if (post.ocr_text) contentDesc += `\nمتن روی تصویر: "${post.ocr_text.slice(0, 300)}"`;
    if (post.manual_context) contentDesc += `\nتوضیح دستی: "${post.manual_context.slice(0, 500)}"`;

    const prompt = `تحلیل این پست را انجام بده. خروجی را دقیقاً به فرمت JSON زیر برگردان (بدون متن اضافه):

محتوای پست:
${contentDesc}

{
  "sentiment_score": عدد -1 تا 1,
  "sentiment_label": "angry/hopeful/neutral/sad",
  "caption_fa": "ترجمه فارسی کپشن (اگر فارسی نیست، وگرنه null)",
  "transcription_fa": "ترجمه فارسی رونوشت صوتی (اگر فارسی نیست، وگرنه null)",
  "ocr_text_fa": "ترجمه فارسی متن تصویر (اگر فارسی نیست، وگرنه null)",
  "topics": ["موضوع۱", "موضوع۲"],
  "keywords": ["کلمه۱", "کلمه۲", "کلمه۳"]
}`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model || 'google/gemini-2.5-pro',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey || process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      },
    );

    const choice = response.data?.choices?.[0];
    const content = choice?.message?.content || choice?.message?.reasoning || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const analysis = JSON.parse(jsonMatch[0]);

    if (analysis.sentiment_score !== undefined) post.sentiment_score = analysis.sentiment_score;
    if (analysis.sentiment_label) post.sentiment_label = analysis.sentiment_label;
    if (analysis.caption_fa) post.caption_fa = analysis.caption_fa;
    if (analysis.transcription_fa) post.transcription_fa = analysis.transcription_fa;
    if (analysis.ocr_text_fa) post.ocr_text_fa = analysis.ocr_text_fa;
    if (analysis.topics) post.extracted_topics = analysis.topics;
    if (analysis.keywords) post.extracted_keywords = analysis.keywords;

    await this.postRepository.save(post);
  }

  async remove(id: number) {
    const post = await this.findById(id);
    return await this.postRepository.remove(post);
  }

  // --- Analytics ---

  async getTrendingKeywords(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const posts = await this.postRepository
      .createQueryBuilder('post')
      .select('post.extracted_keywords')
      .where('post.published_at >= :since', { since })
      .getMany();

    const keywordMap: Record<string, number> = {};
    for (const post of posts) {
      if (post.extracted_keywords) {
        for (const kw of post.extracted_keywords) {
          keywordMap[kw] = (keywordMap[kw] || 0) + 1;
        }
      }
    }

    return Object.entries(keywordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([keyword, count]) => ({ keyword, count }));
  }

  async getSentimentTimeline(pageId?: number, days = 30, dateFilter?: Date) {
    const since = dateFilter || (() => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date;
    })();

    const qb = this.postRepository
      .createQueryBuilder('post')
      .select("DATE(post.published_at)", 'date')
      .addSelect('AVG(post.sentiment_score)', 'avg_sentiment')
      .addSelect('COUNT(*)', 'post_count')
      .where('post.published_at >= :since', { since });

    if (pageId) {
      qb.andWhere('post.page_id = :pageId', { pageId });
    }

    return await qb
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();
  }

  async getTopicGravity(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const posts = await this.postRepository
      .createQueryBuilder('post')
      .select(['post.extracted_topics', 'post.sentiment_label'])
      .where('post.published_at >= :since', { since })
      .getMany();

    const topicMap: Record<string, { count: number; sentiments: Record<string, number> }> = {};
    for (const post of posts) {
      if (post.extracted_topics) {
        for (const topic of post.extracted_topics) {
          if (!topicMap[topic]) topicMap[topic] = { count: 0, sentiments: {} };
          topicMap[topic].count++;
          const label = post.sentiment_label || 'neutral';
          topicMap[topic].sentiments[label] = (topicMap[topic].sentiments[label] || 0) + 1;
        }
      }
    }

    return Object.entries(topicMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([topic, data]) => ({ topic, ...data }));
  }

  async getReshareTree(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await this.postRepository
      .createQueryBuilder('post')
      .select('post.original_source', 'source')
      .addSelect('COUNT(*)', 'reshare_count')
      .where('post.is_reshare = true')
      .andWhere('post.published_at >= :since', { since })
      .groupBy('post.original_source')
      .orderBy('reshare_count', 'DESC')
      .limit(30)
      .getRawMany();
  }

  async getContentHookAnalysis(pageId: number, dateFilter?: Date) {
    // Analyze which content formats get the most engagement for a specific page
    const qb = this.postRepository
      .createQueryBuilder('post')
      .select('post.post_type', 'format')
      .addSelect('AVG(post.likes_count + post.comments_count + post.shares_count)', 'avg_engagement')
      .addSelect('COUNT(*)', 'post_count')
      .where('post.page_id = :pageId', { pageId });

    if (dateFilter) {
      qb.andWhere('post.published_at >= :dateFilter', { dateFilter });
    }

    const posts = await qb
      .groupBy('post.post_type')
      .orderBy('avg_engagement', 'DESC')
      .getRawMany();

    return posts;
  }

  async getReactionVelocity(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Measure average time between a topic appearing and network coverage
    const result = await this.postRepository
      .createQueryBuilder('post')
      .select("DATE(post.published_at)", 'date')
      .addSelect('MIN(post.published_at)', 'first_post')
      .addSelect('MAX(post.published_at)', 'last_post')
      .addSelect('COUNT(DISTINCT post.page_id)', 'unique_pages')
      .addSelect('COUNT(*)', 'total_posts')
      .where('post.published_at >= :since', { since })
      .groupBy('date')
      .orderBy('date', 'DESC')
      .getRawMany();

    return result;
  }

  async getNetworkPulse() {
    // Activity level in the last 24 hours, broken by hour
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const result = await this.postRepository
      .createQueryBuilder('post')
      .select("EXTRACT(HOUR FROM post.published_at)", 'hour')
      .addSelect('COUNT(*)', 'post_count')
      .where('post.published_at >= :since', { since })
      .groupBy('hour')
      .orderBy('hour', 'ASC')
      .getRawMany();

    return result;
  }

  async getNetworkPulseWeekly() {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    // Get posts grouped by date and 6-hour period (0-5, 6-11, 12-17, 18-23)
    const result = await this.postRepository
      .createQueryBuilder('post')
      .select("DATE(post.published_at)", 'date')
      .addSelect("FLOOR(EXTRACT(HOUR FROM post.published_at) / 6)", 'period')
      .addSelect('COUNT(*)', 'count')
      .where('post.published_at >= :since', { since })
      .groupBy('date')
      .addGroupBy('period')
      .orderBy('date', 'ASC')
      .addOrderBy('period', 'ASC')
      .getRawMany();

    return result;
  }

  async getPulseByPage(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const result = await this.postRepository
      .createQueryBuilder('post')
      .select('post.page_id', 'page_id')
      .addSelect("DATE(post.published_at)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('post.published_at >= :since', { since })
      .groupBy('post.page_id')
      .addGroupBy('date')
      .orderBy('post.page_id')
      .addOrderBy('date', 'ASC')
      .getRawMany();

    // Group by page_id → array of { date, count }
    const map: Record<number, { date: string; count: number }[]> = {};
    for (const row of result) {
      const pid = Number(row.page_id);
      if (!map[pid]) map[pid] = [];
      map[pid].push({ date: row.date, count: Number(row.count) });
    }
    return map;
  }

  async getActivityIndex() {
    // Compare last 7 days volume + engagement vs historic average
    // Exclude stories from engagement calculation (they don't return interactions from API)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Last 7 days — post count (all types)
    const recentPostCount = await this.postRepository
      .createQueryBuilder('post')
      .select('COUNT(*)', 'count')
      .where('post.published_at >= :weekAgo', { weekAgo })
      .getRawOne();

    // Last 7 days — engagement (exclude stories)
    const recentEngagement = await this.postRepository
      .createQueryBuilder('post')
      .select('COALESCE(SUM(post.likes_count + post.comments_count + post.shares_count), 0)', 'total')
      .where('post.published_at >= :weekAgo', { weekAgo })
      .andWhere("post.post_type != 'story'")
      .getRawOne();

    // Previous 23 days — post count
    const historicPostCount = await this.postRepository
      .createQueryBuilder('post')
      .select('COUNT(*)', 'count')
      .where('post.published_at >= :monthAgo AND post.published_at < :weekAgo', { monthAgo, weekAgo })
      .getRawOne();

    // Previous 23 days — engagement (exclude stories)
    const historicEngagement = await this.postRepository
      .createQueryBuilder('post')
      .select('COALESCE(SUM(post.likes_count + post.comments_count + post.shares_count), 0)', 'total')
      .where('post.published_at >= :monthAgo AND post.published_at < :weekAgo', { monthAgo, weekAgo })
      .andWhere("post.post_type != 'story'")
      .getRawOne();

    const recentPosts = Number(recentPostCount?.count || 0);
    const recentEng = Number(recentEngagement?.total || 0);
    const historicPosts = Number(historicPostCount?.count || 0);
    const historicEng = Number(historicEngagement?.total || 0);

    // Normalize historic to 7-day equivalent (covers 23 days)
    const historicDays = 23;
    const avgWeeklyPosts = historicDays > 0 ? (historicPosts / historicDays) * 7 : 0;
    const avgWeeklyEngagement = historicDays > 0 ? (historicEng / historicDays) * 7 : 0;

    const postChange = avgWeeklyPosts > 0 ? Math.round(((recentPosts - avgWeeklyPosts) / avgWeeklyPosts) * 100) : (recentPosts > 0 ? 100 : 0);
    const engagementChange = avgWeeklyEngagement > 0 ? Math.round(((recentEng - avgWeeklyEngagement) / avgWeeklyEngagement) * 100) : (recentEng > 0 ? 100 : 0);

    return {
      post_change: postChange,
      engagement_change: engagementChange,
      recent_posts: recentPosts,
      recent_engagement: recentEng,
      avg_weekly_posts: Math.round(avgWeeklyPosts),
      avg_weekly_engagement: Math.round(avgWeeklyEngagement),
    };
  }

  async getHighImpactPosts(limit = 5) {
    const since = new Date();
    since.setDate(since.getDate() - 7); // Last 7 days instead of 24h

    return await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.page', 'page')
      .where('post.published_at >= :since', { since })
      .orderBy('(post.likes_count + post.comments_count + post.shares_count)', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getKeywordVelocity() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const prev24h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [recentPosts, olderPosts] = await Promise.all([
      this.postRepository.createQueryBuilder('post')
        .select(['post.extracted_keywords'])
        .where('post.published_at >= :since', { since: last24h })
        .getMany(),
      this.postRepository.createQueryBuilder('post')
        .select(['post.extracted_keywords'])
        .where('post.published_at >= :start AND post.published_at < :end', { start: prev24h, end: last24h })
        .getMany(),
    ]);

    const recentMap: Record<string, number> = {};
    const olderMap: Record<string, number> = {};

    for (const p of recentPosts) {
      if (p.extracted_keywords) for (const kw of p.extracted_keywords) recentMap[kw] = (recentMap[kw] || 0) + 1;
    }
    for (const p of olderPosts) {
      if (p.extracted_keywords) for (const kw of p.extracted_keywords) olderMap[kw] = (olderMap[kw] || 0) + 1;
    }

    const velocity = Object.entries(recentMap).map(([keyword, count]) => {
      const prev = olderMap[keyword] || 0;
      const change = prev > 0 ? Math.round(((count - prev) / prev) * 100) : (count > 1 ? 999 : 100);
      return { keyword, count, prev_count: prev, change };
    }).sort((a, b) => b.change - a.change);

    return velocity.slice(0, 15);
  }

  async getSentimentInfluenceMatrix() {
    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.page', 'page')
      .where('post.published_at >= :since', { since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
      .getMany();

    // Group by page, calculate avg sentiment and total engagement
    const pageMap: Record<number, { name: string; influence: number; avg_sentiment: number; post_count: number; total_engagement: number }> = {};

    for (const post of posts) {
      if (!post.page) continue;
      if (!pageMap[post.page_id]) {
        pageMap[post.page_id] = {
          name: post.page.name,
          influence: post.page.influence_score || 0,
          avg_sentiment: 0,
          post_count: 0,
          total_engagement: 0,
        };
      }
      const p = pageMap[post.page_id];
      p.avg_sentiment += (post.sentiment_score || 0);
      p.post_count++;
      p.total_engagement += (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0);
    }

    return Object.values(pageMap).map((p) => ({
      name: p.name,
      influence: p.influence,
      sentiment: p.post_count > 0 ? Math.round((p.avg_sentiment / p.post_count) * 100) / 100 : 0,
      engagement: p.total_engagement,
      post_count: p.post_count,
    }));
  }

  async getNarrativeBattle() {
    const topics = await this.getTopicGravity(7);
    const top3 = topics.slice(0, 3);

    return top3.map((topic) => {
      const total = Object.values(topic.sentiments).reduce((s: number, v: number) => s + v, 0);
      const positive = ((topic.sentiments['hopeful'] || 0) / (total || 1)) * 100;
      const negative = ((topic.sentiments['angry'] || 0) / (total || 1)) * 100;
      const neutral = 100 - positive - negative;
      return {
        topic: topic.topic,
        total_posts: topic.count,
        positive: Math.round(positive),
        negative: Math.round(negative),
        neutral: Math.round(neutral),
      };
    });
  }

  async getPostsFeed(query: any) {
    const { sentiment_label, post_type, search, topic, outliers_only, page = 1, limit = 20 } = query;

    const qb = this.postRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.page', 'page');

    if (sentiment_label) qb.andWhere('post.sentiment_label = :sentiment_label', { sentiment_label });
    if (post_type) qb.andWhere('post.post_type = :post_type', { post_type });
    if (search) qb.andWhere('post.caption ILIKE :search', { search: `%${search}%` });
    if (topic) qb.andWhere(':topic = ANY(post.extracted_topics)', { topic });

    qb.orderBy('post.published_at', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // Calculate avg engagement per page for outlier detection
    const enriched = data.map((post) => {
      const engagement = (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0);
      const avgEngagement = post.page ? Math.max((post.page.followers_count || 0) * 0.02, 100) : 100;
      const engagementRatio = avgEngagement > 0 ? engagement / avgEngagement : 0;
      return {
        ...post,
        engagement,
        engagement_ratio: Math.round(engagementRatio * 100) / 100,
        is_outlier: engagementRatio > 2,
        is_viral: engagementRatio > 5,
      };
    });

    const filtered = outliers_only === 'true' ? enriched.filter((p) => p.is_outlier) : enriched;

    return { data: filtered, total, page, limit };
  }

  async getTopicClusters() {
    const topics = await this.getTopicGravity(7);
    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.page', 'page')
      .where('post.published_at >= :since', { since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
      .orderBy('post.published_at', 'DESC')
      .getMany();

    return topics.slice(0, 8).map((topic) => {
      const relatedPosts = posts.filter((p) => p.extracted_topics?.includes(topic.topic)).slice(0, 5);
      return {
        topic: topic.topic,
        count: topic.count,
        sentiments: topic.sentiments,
        posts: relatedPosts,
      };
    });
  }
}
