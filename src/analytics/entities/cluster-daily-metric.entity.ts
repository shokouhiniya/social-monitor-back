import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * موجودیت متریک‌های روزانهٔ هر cluster (ClusterDailyMetric — design §5.9 / §6.8،
 * Requirement 8.6 / 15.3).
 *
 * نگاشت به جدول summary `cluster_daily_metrics` (مهاجرت
 * `Phase6DailyMetrics1739700000000`). ستون‌ها **دقیقاً** با مهاجرت هم‌خوان‌اند:
 *
 *  - `cluster_id`    : ارجاع مفهومی به `clusters.id` (integer ساده، بدون FK سخت).
 *  - `date`          : روز متریک (نوع `date` → رشتهٔ `YYYY-MM-DD`).
 *  - `content_count` : تعداد محتوای cluster در آن روز (integer DEFAULT 0).
 *  - `avg_alignment` : میانگین هم‌راستایی منابع cluster (double precision، nullable).
 *  - `created_at`    : زمان ثبت ردیف summary.
 *
 * unique index روی `(cluster_id, date)` (هم‌خوان با
 * `UQ_cluster_daily_metrics_cluster_date`) برای idempotent ماندن upsert روزانه.
 */
@Entity('cluster_daily_metrics')
@Index('UQ_cluster_daily_metrics_cluster_date', ['cluster_id', 'date'], {
  unique: true,
})
export class ClusterDailyMetricEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  cluster_id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  content_count: number;

  @Column({ type: 'double precision', nullable: true })
  avg_alignment: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
