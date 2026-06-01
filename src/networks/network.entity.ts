import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * موجودیت Network — نگاشت دقیق روی جدول `networks` که در مهاجرت فاز ۲
 * (Phase2NetworksActors1739000000000) ساخته شده است.
 *
 * نمایندهٔ یک محیط/شبکهٔ عملیاتی (داخلی / بین‌الملل). در deployment تک‌شبکه‌ای
 * یک network پیش‌فرض با `slug = 'default'` seed می‌شود (Requirement 1.1).
 *
 * توجه: ستون‌ها باید دقیقاً با مهاجرت مطابقت داشته باشند؛ از این رو نوع‌ها و
 * nullable بودن‌ها به‌صورت صریح تعیین شده‌اند.
 */
@Entity('networks')
export class Network {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  default_language: string | null;

  @Column({ type: 'text', nullable: true })
  target_narrative: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
