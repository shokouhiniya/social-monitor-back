import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * MediaScoreRecord — مقدار سری‌زمانی یک شاخص برای یک میکرورسانه (design §3.5).
 *
 * نگاشت به جدول `media_score_records`. تاریخچه‌دار و مستقل از Stage. برای هر
 * (micro_media, indicator, period_start) حداکثر یک رکورد معتبر وجود دارد
 * (`UNIQUE` — Correctness Property 6). ثبت مقدار جدید همان دوره، رکورد را update
 * می‌کند (upsert).
 */
@Entity('media_score_records')
@Index(
  'UQ_media_score_records_media_indicator_period',
  ['micro_media_id', 'indicator_id', 'period_start'],
  { unique: true },
)
@Index('IDX_media_score_records_media', ['micro_media_id'])
export class MediaScoreRecordEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  micro_media_id: number;

  @Column({ type: 'int' })
  indicator_id: number;

  @Column({ type: 'double precision' })
  value: number;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date', nullable: true })
  period_end: string | null;

  @Column({ type: 'int', nullable: true })
  scored_by_user_id: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
