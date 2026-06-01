import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cluster } from '../modules/cluster/cluster.entity';
import { Page } from '../modules/page/page.entity';
import { ClustersController } from './clusters.controller';
import { ClustersService } from './clusters.service';
import { ClustersSeedService } from './clusters-seed.service';

/**
 * ClustersModule — مدیریت خوشه‌های مدیریت‌شده و نمایندگان (design §5.4).
 *
 * این ماژول بازنویسی تمیز `ClusterModule` فعلی (`modules/cluster/`) در ساختار
 * جدید است و CRUD، seed و مدیریت نمایندگان را پوشش می‌دهد (Requirement 1.1).
 *
 * **مرز تمیز و گراف بدون‌دور (Requirement 1.2):** خوشه روی همان جدول `clusters`
 * و توزیع منابع روی همان جدول `pages` نگاشت می‌شود؛ بنابراین به‌جای تعریف یک
 * entity دوم روی این جدول‌ها، همان موجودیت‌های موجود `Cluster` و `Page` دوباره
 * استفاده می‌شوند (`TypeOrmModule.forFeature([Cluster, Page])`). دسترسی به منابع
 * **مستقیماً از طریق `Repository<Page>`** انجام می‌شود، نه با import کردن
 * `SourcesService`. به این ترتیب هیچ وابستگی متقابل (mutual/circular) با
 * `SourcesModule` ایجاد نمی‌شود و نیازی به `forwardRef` نیست — گراف وابستگی
 * بدون‌دور (acyclic) باقی می‌ماند.
 *
 * **گذار غیرتخریبی (Requirement 1.6):** در `app.module.ts` به‌صورت dual-import
 * در کنار `ClusterModule` (legacy) ثبت می‌شود. برای اجتناب از تداخل مسیر،
 * کنترلر جدید روی فضای‌نام `/clusters-v2` ثبت می‌شود تا مسیرهای `/clusters`
 * موجود دست‌نخورده بمانند. `ClustersService` صادر می‌شود تا مصرف‌کنندگان آینده
 * (مثلاً Analytics سطح خوشه) بتوانند از آن استفاده کنند.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Cluster, Page])],
  controllers: [ClustersController],
  providers: [ClustersService, ClustersSeedService],
  exports: [ClustersService],
})
export class ClustersModule {}
