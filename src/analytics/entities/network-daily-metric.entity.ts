import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * موجودیت متریک‌های روزانهٔ هر شبکه (NetworkDailyMetric — design §5.9 / §6.8،
 * Requirement 8.6 / 15.3).
 *
 * نگاشت به جدول summary `network_daily_metrics` (مهاجرت
 * `Phase6DailyMetrics1739700000000`). ستون‌ها **دقیقاً** با مهاجرت هم‌خوان‌اند
 * (نام، نوع و nullable بودن):
 *
 *  - `network_id`     : ارجاع مفهومی به `networks.id` (integer ساده، بدون FK سخت).
 *  - `date`           : روز متریک (نوع `date` → رشتهٔ `YYYY-MM-DD`).
 *  - `active_sources` : تعداد منبع فعال آن روز (integer DEFAULT 0).
 *  - `new_content`    : تعداد محتوای جدید آن روز (integer DEFAULT 0).
 *  - `avg_sentiment`  : میانگین احساس آن روز (double precision، nullable).
 *  - `alert_count`    : شمار هشدار آن روز (integer DEFAULT 0).
 *  - `created_at`     : زمان ثبت ردیف summary.
 *
 * unique index روی `(network_id, date)` (هم‌خوان با
 * `UQ_network_daily_metrics_network_date`) تضمین می‌کند برای هر شبکه در هر روز
 * تنها یک ردیف وجود داشته باشد و upsert روزانهٔ `refreshSummaries` idempotent بماند.
 */
@Entity('network_daily_metrics')
@Index('UQ_network_daily_metrics_network_date', ['network_id', 'date'], {
  unique: true,
})
export class NetworkDailyMetricEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  network_id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  active_sources: number;

  @Column({ type: 'int', default: 0 })
  new_content: number;

  @Column({ type: 'double precision', nullable: true })
  avg_sentiment: number | null;

  @Column({ type: 'int', default: 0 })
  alert_count: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
