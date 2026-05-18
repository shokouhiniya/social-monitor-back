import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Cluster } from './cluster.entity';
import { Page } from '../page/page.entity';
import { TOPICAL_CLUSTERS } from '../page/page.constants';

/**
 * Seeds the clusters table on startup if empty,
 * then auto-assigns pages that have a category but no cluster_id.
 */
@Injectable()
export class ClusterSeedService implements OnModuleInit {
  private readonly logger = new Logger(ClusterSeedService.name);

  constructor(
    @InjectRepository(Cluster)
    private readonly clusterRepository: Repository<Cluster>,
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
  ) {}

  async onModuleInit() {
    await this.seedClusters();
    await this.autoAssignPages();
  }

  /**
   * If the clusters table is empty, create one cluster per TOPICAL_CLUSTERS entry.
   */
  private async seedClusters() {
    const count = await this.clusterRepository.count();
    if (count > 0) {
      this.logger.log(`✅ ${count} clusters already exist — skipping seed`);
      return;
    }

    this.logger.log('🌱 Seeding clusters from TOPICAL_CLUSTERS...');

    const colors = [
      '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828',
      '#00838f', '#4e342e', '#283593', '#558b2f', '#ad1457',
      '#0097a7', '#6a1b9a', '#ef6c00', '#2e7d32', '#d84315',
      '#1565c0', '#4527a0', '#ff8f00', '#00695c', '#c2185b',
      '#5d4037', '#37474f', '#827717', '#880e4f', '#01579b',
    ];

    let idx = 0;
    for (const [key, value] of Object.entries(TOPICAL_CLUSTERS)) {
      const cluster = this.clusterRepository.create({
        name: value.label,
        description: value.description,
        color: colors[idx % colors.length],
      });
      await this.clusterRepository.save(cluster);
      idx++;
    }

    this.logger.log(`✅ Seeded ${idx} clusters`);
  }

  /**
   * For pages that have a `category` set but no `cluster_id`,
   * find the matching cluster by label and assign them.
   */
  private async autoAssignPages() {
    // Build a map: category key → cluster id
    const allClusters = await this.clusterRepository.find();
    if (allClusters.length === 0) return;

    // Map from TOPICAL_CLUSTERS label → cluster.id
    const labelToClusterId = new Map<string, number>();
    for (const cluster of allClusters) {
      labelToClusterId.set(cluster.name, cluster.id);
    }

    // Also map from category key → cluster.id (using TOPICAL_CLUSTERS)
    const keyToClusterId = new Map<string, number>();
    for (const [key, value] of Object.entries(TOPICAL_CLUSTERS)) {
      const clusterId = labelToClusterId.get(value.label);
      if (clusterId) {
        keyToClusterId.set(key, clusterId);
      }
    }

    // Find pages with category but no cluster_id
    const unassigned = await this.pageRepository.find({
      where: { cluster_id: IsNull() },
    });

    if (unassigned.length === 0) {
      this.logger.log('✅ All pages already have cluster assignments');
      return;
    }

    let assigned = 0;
    for (const page of unassigned) {
      if (!page.category) continue;

      const clusterId = keyToClusterId.get(page.category);
      if (clusterId) {
        page.cluster_id = clusterId;
        await this.pageRepository.save(page);
        assigned++;
      }
    }

    if (assigned > 0) {
      this.logger.log(`✅ Auto-assigned ${assigned} pages to clusters (${unassigned.length - assigned} had no matching category)`);
    }
  }
}
