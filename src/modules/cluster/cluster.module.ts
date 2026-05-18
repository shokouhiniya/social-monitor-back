import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cluster } from './cluster.entity';
import { Page } from '../page/page.entity';
import { ClusterController } from './cluster.controller';
import { ClusterService } from './cluster.service';
import { ClusterSeedService } from './cluster-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cluster, Page])],
  controllers: [ClusterController],
  providers: [ClusterService, ClusterSeedService],
  exports: [ClusterService],
})
export class ClusterModule {}
