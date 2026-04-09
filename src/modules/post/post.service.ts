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
}
