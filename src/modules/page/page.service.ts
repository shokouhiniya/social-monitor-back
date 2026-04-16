import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
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
    // This is a placeholder for the actual API call to fetch page data
    // In production, this would call Instagram/Twitter API or a scraper
    const page = await this.pageRepository.findOne({ where: { id } });
    if (!page) throw new HttpException('Page not found', 404);

    // Simulate fetched data
    const fetchedData: any = {
      followers_count: page.followers_count || Math.floor(Math.random() * 500000),
      following_count: page.following_count || Math.floor(Math.random() * 2000),
      bio: page.bio || `بیو واکشی‌شده برای @${page.username}`,
      profile_image_url: page.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(page.name)}&background=random`,
    };

    // Mark as fetched
    Object.assign(page, fetchedData);
    const saved = await this.pageRepository.save(page);

    return { page: saved, status: 'fetched', message: 'دیتای اولیه پیج با موفقیت واکشی شد' };
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
