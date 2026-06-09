import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * OperationOutput — خروجی واقعی و اثرسنجی یک عملیات (design §3.8).
 *
 * نگاشت به جدول `operation_outputs`. `operation_id` با ON DELETE CASCADE؛
 * `micro_media_id`/`page_id`/`task_id` ارجاع نرم (SET NULL در مهاجرت).
 *  - `output_type`: post | story | video | message | campaign_participation | offline_action | other.
 *  - `source`: manual | api | system.
 * اعداد views/likes/comments/shares برای اثرسنجی استفاده می‌شوند.
 */
@Entity('operation_outputs')
@Index('IDX_operation_outputs_operation', ['operation_id'])
export class OperationOutputEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  operation_id: number;

  @Column({ type: 'int', nullable: true })
  micro_media_id: number | null;

  @Column({ type: 'int', nullable: true })
  page_id: number | null;

  @Column({ type: 'int', nullable: true })
  task_id: number | null;

  @Column({ type: 'varchar', default: 'other' })
  output_type: string;

  @Column({ type: 'varchar', nullable: true })
  output_url: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date | null;

  @Column({ type: 'int', nullable: true })
  views: number | null;

  @Column({ type: 'int', nullable: true })
  likes: number | null;

  @Column({ type: 'int', nullable: true })
  comments: number | null;

  @Column({ type: 'int', nullable: true })
  shares: number | null;

  @Column({ type: 'double precision', nullable: true })
  engagement: number | null;

  @Column({ type: 'timestamp', nullable: true })
  captured_at: Date | null;

  /** منبع داده: manual | api | system. */
  @Column({ type: 'varchar', default: 'manual' })
  source: string;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
