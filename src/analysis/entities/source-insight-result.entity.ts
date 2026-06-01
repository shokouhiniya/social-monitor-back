import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * موجودیت خروجی structured بینش یک Source (design §6.6، Requirement 7.3).
 *
 * نگاشت به جدول `source_insight_results` (مهاجرت
 * `Phase3AnalysisResults1739400000000`). ستون‌ها **دقیقاً** با مهاجرت هم‌خوان‌اند.
 *
 *  - `source_id`         : ارجاع مفهومی به `pages.id` (integer ساده، بدون FK).
 *  - `analysis_run_id`   : ارجاع به `analysis_runs.id` (nullable).
 *  - `prompt_version_id` : نسخهٔ prompt استفاده‌شده (nullable).
 *  - `model`             : مدل OpenRouter استفاده‌شده (nullable).
 *  - فیلدهای متنی/jsonb مطابق `SourceInsightOutput`.
 */
@Entity('source_insight_results')
export class SourceInsightResultEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_source_insight_results_source_id')
  @Column({ type: 'int' })
  source_id: number;

  @Column({ type: 'int', nullable: true })
  analysis_run_id: number | null;

  @Column({ type: 'int', nullable: true })
  prompt_version_id: number | null;

  @Column({ nullable: true })
  model: string | null;

  @Column({ type: 'text', nullable: true })
  narrative_description: string | null;

  @Column({ type: 'text', nullable: true })
  audience_description: string | null;

  @Column({ type: 'text', nullable: true })
  engagement_suggestion: string | null;

  @Column({ type: 'jsonb', nullable: true })
  persona_radar: Record<string, number> | null;

  @Column({ type: 'jsonb', nullable: true })
  pain_points: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  topic_distribution: Array<{ topic: string; weight: number }> | null;

  @Column({ type: 'jsonb', nullable: true })
  strategic_notes: string[] | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
