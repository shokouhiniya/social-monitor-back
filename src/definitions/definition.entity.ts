import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Definition — جدول تعاریف مرجع (taxonomy) که super_admin مدیریت می‌کند.
 *
 * نگاشت به جدول `definitions`. با ستون `type` چند نوع تعریف را در یک جدول نگه
 * می‌دارد:
 *  - `identity`  → هویت میکرورسانه (ژورنالیست، بلاگر، روحانی، ...)
 *  - `platform`  → سکو/پلتفرم (اینستاگرام، تلگرام، بله، ایتا، ...)
 *
 * خوشه‌ها (`cluster`) جدا و در جدول موجود `clusters` مدیریت می‌شوند (چون
 * micro_media.topic_cluster_id و موتور AI به آن جدول ارجاع می‌دهند).
 */
@Entity('definitions')
@Index('IDX_definitions_type', ['type'])
export class DefinitionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** نوع تعریف: identity | platform. */
  @Column({ type: 'varchar', length: 32 })
  type: string;

  /**
   * کلید پایدار (slug) — برای سکوها مقدار ستون `pages.platform` را تعیین می‌کند
   * (مثل instagram/telegram/bale) تا تحلیل و فیلتر بر اساس آن انجام شود. برای
   * هویت‌ها معمولاً null است.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  key: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** آیکن اختیاری (برای سکوها مفید است). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  icon: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
