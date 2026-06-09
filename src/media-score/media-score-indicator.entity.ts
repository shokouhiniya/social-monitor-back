import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * MediaScoreIndicator — تعریف یک شاخص انسانی قابل امتیازدهی (design §3.5).
 *
 * نگاشت به جدول `media_score_indicators`. `key` انگلیسی و پایدار، `title` فارسی.
 * شاخص‌ها از پنل تنظیمات (super_admin) قابل فعال/غیرفعال‌سازی‌اند. مقدار هر رکورد
 * امتیاز باید در بازهٔ `[min_value, max_value]` باشد (Correctness Property 3).
 */
@Entity('media_score_indicators')
export class MediaScoreIndicatorEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('UQ_media_score_indicators_key', { unique: true })
  @Column()
  key: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'double precision', default: 0 })
  min_value: number;

  @Column({ type: 'double precision', default: 100 })
  max_value: number;

  @Column({ type: 'double precision', default: 1 })
  weight: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
