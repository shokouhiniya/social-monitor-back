import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Post } from './post.entity';
import { CreatePostDto, PostQueryDto } from './post.dto';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
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

  async getSentimentTimeline(pageId?: number, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

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

  async getContentHookAnalysis(pageId: number) {
    // Analyze which content formats get the most engagement for a specific page
    const posts = await this.postRepository
      .createQueryBuilder('post')
      .select('post.post_type', 'format')
      .addSelect('AVG(post.likes_count + post.comments_count + post.shares_count)', 'avg_engagement')
      .addSelect('COUNT(*)', 'post_count')
      .where('post.page_id = :pageId', { pageId })
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

  async getHighImpactPosts(limit = 5) {
    const since = new Date();
    since.setHours(since.getHours() - 24);

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
