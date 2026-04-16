import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import axios from 'axios';
import { Page } from './page.entity';
import { CreatePageDto, UpdatePageDto, PageQueryDto } from './page.dto';

@Injectable()
export class PageService {
  constructor(
    @InjectRepository(Page)
    private pageRepository: Repository<Page>,
  ) {}

  async findAll(query: PageQueryDto) {
    const { category, platform, cluster, country, search, page = 1, limit = 20 } = query;
    const segment = (query as any).segment;

    const qb = this.pageRepository.createQueryBuilder('page');

    if (category) qb.andWhere('page.category = :category', { category });
    if (platform) qb.andWhere('page.platform = :platform', { platform });
    if (cluster) qb.andWhere('page.cluster = :cluster', { cluster });
    if (country) qb.andWhere('page.country = :country', { country });
    if (search) qb.andWhere('page.name ILIKE :search', { search: `%${search}%` });

    // Segment filters
    if (segment === 'ghost') {
      qb.andWhere('(page.consistency_rate < 2 OR page.is_active = false)');
    } else if (segment === 'high_influence_low_credibility') {
      qb.andWhere('page.influence_score > 7 AND page.credibility_score < 4');
    } else if (segment === 'new') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      qb.andWhere('page.created_at >= :weekAgo', { weekAgo });
    }

    qb.orderBy('page.influence_score', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: number) {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['posts', 'field_reports'],
    });
    if (!page) throw new HttpException('Page not found', 404);
    return page;
  }

  async create(dto: CreatePageDto) {
    const page = this.pageRepository.create(dto);
    return await this.pageRepository.save(page);
  }

  async createBulk(dtos: CreatePageDto[]) {
    const pages = this.pageRepository.create(dtos);
    return await this.pageRepository.save(pages);
  }

  async fetchPageData(id: number) {
    const page = await this.pageRepository.findOne({ where: { id } });
    if (!page) throw new HttpException('Page not found', 404);
    if (!page.username) throw new HttpException('Username is required for fetching', 400);

    try {
      const response = await axios.get('https://instagram-looter2.p.rapidapi.com/profile', {
        params: { username: page.username },
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'b79509e210msh113fb4eced81297p155bcajsn897485f63480',
          'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com',
        },
        timeout: 20000,
      });

      const data = response.data;
      if (!data || !data.status) {
        throw new Error('Invalid response from API');
      }

      const updateData: any = {
        name: data.full_name || page.name,
        bio: data.biography || page.bio,
        followers_count: data.edge_followed_by?.count ?? page.followers_count,
        following_count: data.edge_follow?.count ?? page.following_count,
        profile_image_url: data.profile_pic_url_hd || data.profile_pic_url || page.profile_image_url,
      };

      Object.assign(page, updateData);
      const saved = await this.pageRepository.save(page);

      return {
        page: saved,
        status: 'fetched',
        message: 'دیتای پروفایل با موفقیت از اینستاگرام واکشی شد',
        raw: {
          is_verified: data.is_verified,
          is_private: data.is_private,
          is_business: data.is_business_account,
          posts_count: data.edge_owner_to_timeline_media?.count,
          category: data.category_name || data.business_category_name,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      const statusCode = error?.response?.status || 502;
      const apiMessage = error?.response?.data?.message || error.message;

      // If API blocked (451/403), set fallback avatar
      if (statusCode === 451 || statusCode === 403) {
        page.profile_image_url = page.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(page.name)}&background=random&size=200`;
        await this.pageRepository.save(page);
        throw new HttpException(`API اینستاگرام از این IP مسدود است (${statusCode}). لطفاً VPN را بررسی کنید.`, 503);
      }

      throw new HttpException(`واکشی ناموفق (${statusCode}): ${apiMessage}`, 502);
    }
  }

  async processWithLLM(id: number) {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['posts'],
    });
    if (!page) throw new HttpException('Page not found', 404);

    // Build context for LLM
    const recentPosts = (page.posts || [])
      .sort((a, b) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime())
      .slice(0, 10);

    const postsText = recentPosts.map((p, i) =>
      `پست ${i + 1}: "${(p.caption || '').slice(0, 200)}" (لایک: ${p.likes_count}, کامنت: ${p.comments_count}, لحن: ${p.sentiment_label || 'نامشخص'})`
    ).join('\n');

    const prompt = `تو یک تحلیل‌گر رسانه‌ای هوشمند هستی. اطلاعات زیر مربوط به یک پیج اینستاگرامی است. لطفاً تحلیل کامل ارائه بده.

اطلاعات پیج:
- نام: ${page.name}
- یوزرنیم: @${page.username}
- پلتفرم: ${page.platform}
- بیو: ${page.bio || 'ندارد'}
- فالوور: ${page.followers_count}
- فالووینگ: ${page.following_count}
- دسته‌بندی فعلی: ${page.category || 'نامشخص'}
- کشور: ${page.country || 'نامشخص'}

آخرین پست‌ها:
${postsText || 'پستی ثبت نشده'}

لطفاً خروجی را دقیقاً به فرمت JSON زیر برگردان (بدون هیچ متن اضافه):
{
  "category": "دسته‌بندی پیشنهادی (news/activist/celebrity/lifestyle/economy/local_news/politician/documentary/religious/art/student/health/technology/culture/sports/analyst)",
  "cluster": "نام خوشه معنایی (مثلاً: رسانه مقاومت، لایف‌استایل، رسانه بین‌المللی)",
  "credibility_score": عدد از 0 تا 10,
  "influence_score": عدد از 0 تا 10,
  "consistency_rate": عدد از 0 تا 10,
  "persona_radar": {
    "aggressive_defensive": عدد 0 تا 100,
    "producer_resharer": عدد 0 تا 100,
    "visual_textual": عدد 0 تا 100,
    "formal_informal": عدد 0 تا 100,
    "local_global": عدد 0 تا 100,
    "interactive_oneway": عدد 0 تا 100
  },
  "pain_points": ["دغدغه ۱", "دغدغه ۲", "دغدغه ۳"],
  "keywords": ["کلمه ۱", "کلمه ۲", "کلمه ۳", "کلمه ۴", "کلمه ۵"],
  "language": "زبان اصلی محتوا"
}`;

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'google/gemini-2.5-pro',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      );

      const content = response.data?.choices?.[0]?.message?.content || '';

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new HttpException('LLM response did not contain valid JSON', 502);
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Update page with LLM analysis
      const updateData: any = {};
      if (analysis.category) updateData.category = analysis.category;
      if (analysis.cluster) updateData.cluster = analysis.cluster;
      if (analysis.credibility_score !== undefined) updateData.credibility_score = analysis.credibility_score;
      if (analysis.influence_score !== undefined) updateData.influence_score = analysis.influence_score;
      if (analysis.consistency_rate !== undefined) updateData.consistency_rate = analysis.consistency_rate;
      if (analysis.persona_radar) updateData.persona_radar = analysis.persona_radar;
      if (analysis.pain_points) updateData.pain_points = analysis.pain_points;
      if (analysis.keywords) updateData.keywords = analysis.keywords;
      if (analysis.language) updateData.language = analysis.language;

      Object.assign(page, updateData);
      const saved = await this.pageRepository.save(page);

      return {
        page: saved,
        status: 'processed',
        message: 'تحلیل هوشمند با موفقیت انجام شد',
        analysis,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`خطا در پردازش LLM: ${error.message}`, 502);
    }
  }

  async update(id: number, dto: UpdatePageDto) {
    const page = await this.findById(id);
    Object.assign(page, dto);
    return await this.pageRepository.save(page);
  }

  async remove(id: number) {
    const page = await this.findById(id);
    return await this.pageRepository.remove(page);
  }

  // --- Analytics helpers ---

  async getCategoryDistribution() {
    return await this.pageRepository
      .createQueryBuilder('page')
      .select('page.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('page.category')
      .getRawMany();
  }

  async getClusterDistribution() {
    return await this.pageRepository
      .createQueryBuilder('page')
      .select('page.cluster', 'cluster')
      .addSelect('COUNT(*)', 'count')
      .groupBy('page.cluster')
      .getRawMany();
  }

  async getCountryDistribution() {
    return await this.pageRepository
      .createQueryBuilder('page')
      .select('page.country', 'country')
      .addSelect('COUNT(*)', 'count')
      .groupBy('page.country')
      .getRawMany();
  }

  async getTopInfluencers(limit = 20) {
    return await this.pageRepository.find({
      order: { influence_score: 'DESC' },
      take: limit,
    });
  }

  async getGhostPages() {
    return await this.pageRepository
      .createQueryBuilder('page')
      .where('page.consistency_rate < :threshold', { threshold: 2 })
      .orWhere('page.is_active = false')
      .orderBy('page.consistency_rate', 'ASC')
      .limit(50)
      .getMany();
  }

  async getSegmentCounts() {
    const [total, ghost, highInfluenceLowCred] = await Promise.all([
      this.pageRepository.count(),
      this.pageRepository.createQueryBuilder('page')
        .where('page.consistency_rate < 2 OR page.is_active = false')
        .getCount(),
      this.pageRepository.createQueryBuilder('page')
        .where('page.influence_score > 7 AND page.credibility_score < 4')
        .getCount(),
    ]);

    return { total, ghost, high_influence_low_credibility: highInfluenceLowCred };
  }

  async getRelatedPages(pageId: number, limit = 8) {
    const page = await this.pageRepository.findOne({ where: { id: pageId } });
    if (!page) return [];

    const qb = this.pageRepository.createQueryBuilder('p')
      .where('p.id != :pageId', { pageId });

    if (page.cluster) {
      qb.andWhere('(p.cluster = :cluster OR p.category = :category)', { cluster: page.cluster, category: page.category });
    } else if (page.category) {
      qb.andWhere('p.category = :category', { category: page.category });
    }

    qb.orderBy('p.influence_score', 'DESC').limit(limit);
    return await qb.getMany();
  }
}
