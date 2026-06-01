import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * موجودیت متریک‌های روزانهٔ هر منبع (SourceDailyMetric — design §5.9 / §6.8،
 * Requirement 8.6 / 15.3).
 *
 * نگاشت به جدول summary `source_daily_metrics` (مهاجرت
 * `Phase6DailyMetrics1739700000000`). ستون‌ها **دقیقاً** با مهاجرت هم‌خوان‌اند:
 *
 *  - `source_id`       : ارجاع مفهومی به `pages.id` (integer ساده، بدون FK سخت).
 *  - `date`            : روز متریک (نوع `date` → رشتهٔ `YYYY-MM-DD`).
 *  - `new_content`     : تعداد محتوای جدید آن روز (integer DEFAULT 0).
 *  - `avg_sentiment`   : میانگین احساس آن روز (double precision، nullable).
 *  - `engagement_rate` : نرخ تعامل آن روز (double precision، nullable).
 *  - `created_at`      : زمان ثبت ردیف summary.
 *
 * unique index روی `(source_id, date)` (هم‌خوان با
 * `UQ_source_daily_metrics_source_date`) برای idempotent ماندن upsert روزانه.
 */
@Entity('source_daily_metrics')
@Index('UQ_source_daily_metrics_source_date', ['source_id', 'date'], {
  unique: true,
})
export class SourceDailyMetricEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  source_id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  new_content: number;

  @Column({ type: 'double precision', nullable: true })
  avg_sentiment: number | null;

  @Column({ type: 'double precision', nullable: true })
  engagement_rate: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
