import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * MediaPerformanceSnapshot — عکس‌فوری سری‌زمانی دادهٔ عملکردی (design §3.4).
 *
 * نگاشت به جدول `media_performance_snapshots`. برخلاف مقدار آخرِ روی `pages`،
 * این جدول روند را در طول زمان نگه می‌دارد تا داشبورد رشد ممکن شود.
 *
 *  - `page_id` پر می‌شود اگر داده از یک حساب پلتفرمی خاص باشد (nullable).
 *  - `source`: api | manual | system.
 */
@Entity('media_performance_snapshots')
@Index('IDX_media_perf_media_captured', ['micro_media_id', 'captured_at'])
export class MediaPerformanceSnapshotEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  micro_media_id: number;

  @Column({ type: 'int', nullable: true })
  page_id: number | null;

  @Column({ type: 'varchar', nullable: true })
  platform: string | null;

  @Column({ type: 'int', nullable: true })
  followers: number | null;

  @Column({ type: 'int', nullable: true })
  views: number | null;

  @Column({ type: 'int', nullable: true })
  likes: number | null;

  @Column({ type: 'int', nullable: true })
  comments: number | null;

  @Column({ type: 'int', nullable: true })
  shares: number | null;

  @Column({ type: 'int', nullable: true })
  posts_count: number | null;

  @Column({ type: 'int', nullable: true })
  content_count: number | null;

  @Column({ type: 'double precision', nullable: true })
  engagement_rate: number | null;

  @Column({ type: 'double precision', nullable: true })
  growth_rate: number | null;

  @Column({ type: 'timestamp' })
  captured_at: Date;

  /** منبع داده: api | manual | system. */
  @Column({ type: 'varchar', default: 'manual' })
  source: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
