import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * موجودیت شمار/سرعت رشد روزانهٔ هر کلیدواژه (KeywordDailyMetric — design §5.9 /
 * §6.8، Requirement 8.4 / 8.6 / 15.3).
 *
 * نگاشت به جدول summary `keyword_daily_metrics` (مهاجرت
 * `Phase6DailyMetrics1739700000000`). ستون‌ها **دقیقاً** با مهاجرت هم‌خوان‌اند:
 *
 *  - `keyword`     : خود کلیدواژه (character varying).
 *  - `date`        : روز متریک (نوع `date` → رشتهٔ `YYYY-MM-DD`).
 *  - `scope`       : دامنهٔ شمارش (مثلاً سراسری یا یک شبکه؛ nullable).
 *  - `count`       : تعداد رخداد کلیدواژه در آن روز/دامنه (integer DEFAULT 0).
 *  - `velocity`    : سرعت رشد نسبت به روز قبل (double precision، nullable).
 *  - `created_at`  : زمان ثبت ردیف summary.
 *
 * index **غیر-unique** روی `(keyword, date)` (هم‌خوان با
 * `IDX_keyword_daily_metrics_keyword_date`) — چون یک کلیدواژه می‌تواند در یک روز
 * چند `scope` داشته باشد، unique نیست.
 */
@Entity('keyword_daily_metrics')
@Index('IDX_keyword_daily_metrics_keyword_date', ['keyword', 'date'])
export class KeywordDailyMetricEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  keyword: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', nullable: true })
  scope: string | null;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ type: 'double precision', nullable: true })
  velocity: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
