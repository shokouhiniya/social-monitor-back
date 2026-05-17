import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cluster } from './cluster.entity';
import { Page } from '../page/page.entity';
import {
  AssignPagesDto,
  CreateClusterDto,
  SetRepresentativesDto,
  TogglePageRepresentativeDto,
  UpdateClusterDto,
} from './cluster.dto';

@Injectable()
export class ClusterService {
  constructor(
    @InjectRepository(Cluster)
    private readonly clusterRepository: Repository<Cluster>,
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
  ) {}

  async findAll() {
    const clusters = await this.clusterRepository.find({
      order: { created_at: 'ASC' },
    });

    // Attach quick stats per cluster
    const result = await Promise.all(
      clusters.map(async (c) => {
        const [pagesCount, representativesCount] = await Promise.all([
          this.pageRepository.count({ where: { cluster_id: c.id } }),
          this.pageRepository.count({
            where: { cluster_id: c.id, is_representative: true },
          }),
        ]);
        return {
          ...c,
          pages_count: pagesCount,
          representatives_count: representativesCount,
        };
      }),
    );

    return result;
  }

  async findById(id: number) {
    const cluster = await this.clusterRepository.findOne({ where: { id } });
    if (!cluster) throw new HttpException('Cluster not found', 404);

    const pages = await this.pageRepository.find({
      where: { cluster_id: id },
      order: { is_representative: 'DESC', influence_score: 'DESC' },
    });

    return {
      ...cluster,
      pages,
      pages_count: pages.length,
      representatives_count: pages.filter((p) => p.is_representative).length,
    };
  }

  async create(dto: CreateClusterDto) {
    const existing = await this.clusterRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new HttpException(`خوشه‌ای با نام «${dto.name}» قبلاً ساخته شده است`, 409);
    }
    const cluster = this.clusterRepository.create(dto);
    return await this.clusterRepository.save(cluster);
  }

  async update(id: number, dto: UpdateClusterDto) {
    const cluster = await this.clusterRepository.findOne({ where: { id } });
    if (!cluster) throw new HttpException('Cluster not found', 404);
    Object.assign(cluster, dto);
    return await this.clusterRepository.save(cluster);
  }

  async remove(id: number) {
    const cluster = await this.clusterRepository.findOne({ where: { id } });
    if (!cluster) throw new HttpException('Cluster not found', 404);
    // Detach all pages from this cluster
    await this.pageRepository.update(
      { cluster_id: id },
      { cluster_id: null, is_representative: false },
    );
    await this.clusterRepository.remove(cluster);
    return { success: true };
  }

  async getPages(id: number) {
    const cluster = await this.clusterRepository.findOne({ where: { id } });
    if (!cluster) throw new HttpException('Cluster not found', 404);
    return await this.pageRepository.find({
      where: { cluster_id: id },
      order: { is_representative: 'DESC', influence_score: 'DESC' },
    });
  }

  /** Add pages to this cluster (does not remove existing ones) */
  async assignPages(id: number, dto: AssignPagesDto) {
    const cluster = await this.clusterRepository.findOne({ where: { id } });
    if (!cluster) throw new HttpException('Cluster not found', 404);
    if (!dto.page_ids?.length) return { updated: 0 };
    const result = await this.pageRepository.update(
      { id: In(dto.page_ids) },
      { cluster_id: id },
    );
    return { updated: result.affected ?? 0 };
  }

  /** Remove pages from this cluster */
  async removePages(id: number, dto: AssignPagesDto) {
    const cluster = await this.clusterRepository.findOne({ where: { id } });
    if (!cluster) throw new HttpException('Cluster not found', 404);
    if (!dto.page_ids?.length) return { updated: 0 };
    const result = await this.pageRepository.update(
      { id: In(dto.page_ids), cluster_id: id },
      { cluster_id: null, is_representative: false },
    );
    return { updated: result.affected ?? 0 };
  }

  /** Replace the full set of representative pages for a cluster */
  async setRepresentatives(id: number, dto: SetRepresentativesDto) {
    const cluster = await this.clusterRepository.findOne({ where: { id } });
    if (!cluster) throw new HttpException('Cluster not found', 404);

    // Unset all representatives in this cluster
    await this.pageRepository.update(
      { cluster_id: id },
      { is_representative: false },
    );

    if (dto.page_ids?.length) {
      // Set the chosen ones (only if they are part of this cluster)
      await this.pageRepository.update(
        { id: In(dto.page_ids), cluster_id: id },
        { is_representative: true },
      );
    }

    return await this.getPages(id);
  }

  async togglePageRepresentative(
    clusterId: number,
    pageId: number,
    dto: TogglePageRepresentativeDto,
  ) {
    const page = await this.pageRepository.findOne({ where: { id: pageId } });
    if (!page) throw new HttpException('Page not found', 404);
    if (page.cluster_id !== Number(clusterId)) {
      throw new HttpException('این پیج عضو این خوشه نیست', 400);
    }
    page.is_representative = !!dto.is_representative;
    return await this.pageRepository.save(page);
  }
}
