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
    const where: any = {};

    if (category) where.category = category;
    if (platform) where.platform = platform;
    if (cluster) where.cluster = cluster;
    if (country) where.country = country;
    if (search) where.name = Like(`%${search}%`);

    const [data, total] = await this.pageRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { influence_score: 'DESC' },
    });

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
    // Pages with low consistency, low activity, or potential content deletion
    return await this.pageRepository
      .createQueryBuilder('page')
      .where('page.consistency_rate < :threshold', { threshold: 2 })
      .orWhere('page.is_active = false')
      .orderBy('page.consistency_rate', 'ASC')
      .limit(50)
      .getMany();
  }
}
