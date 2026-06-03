import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * موجودیت خروجی structured تحلیل یک ContentItem (design §6.5، Requirement 7.1).
 *
 * نگاشت به جدول `content_analysis_results` (مهاجرت
 * `Phase3AnalysisResults1739400000000`). ستون‌ها **دقیقاً** با مهاجرت هم‌خوان‌اند.
 *
 *  - `content_id`        : ارجاع مفهومی به `posts.id` (integer ساده، بدون FK).
 *  - `analysis_run_id`   : ارجاع به `analysis_runs.id` (nullable, بدون FK).
 *  - `prompt_version_id` : نسخهٔ prompt استفاده‌شده (nullable).
 *  - `model`             : مدل OpenRouter استفاده‌شده (nullable).
 *  - فیلدهای sentiment/keywords/topics/... مطابق `ContentAnalysisOutput`.
 *
 * نکتهٔ مرزی (Requirement 13.5/13.6 — تسک ۵.۹): این entity تنها محل ذخیرهٔ
 * structured تحلیل است. دوگانه‌نویسی اتمیک به ستون‌های قدیمی `posts`
 * (`sentiment_score`/`extracted_keywords`) در تسک ۵.۹ افزوده می‌شود.
 */
@Entity('content_analysis_results')
export class ContentAnalysisResultEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_content_analysis_results_content_id')
  @Column({ type: 'int' })
  content_id: number;

  @Column({ type: 'int', nullable: true })
  analysis_run_id: number | null;

  @Column({ type: 'int', nullable: true })
  prompt_version_id: number | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'double precision', nullable: true })
  sentiment_score: number | null;

  @Column({ type: 'varchar', nullable: true })
  sentiment_label: string | null;

  @Column({ type: 'text', nullable: true })
  sentiment_reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  keywords: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  topics: string[] | null;

  @Column({ type: 'text', nullable: true })
  summary_fa: string | null;

  @Column({ type: 'boolean', nullable: true })
  is_relevant: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  coverage_type: string | null;

  @Column({ type: 'text', nullable: true })
  narrative_position: string | null;

  @Column({ type: 'varchar', nullable: true })
  risk_level: string | null;

  @Column({ type: 'varchar', nullable: true })
  recommended_attention: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
