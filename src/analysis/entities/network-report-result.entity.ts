import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NetworkReportOutput } from '../schemas/network-report.schema';

/**
 * موجودیت گزارش دوره‌ای سطح شبکه (design §5.8، Requirement 7.4).
 *
 * نگاشت به جدول `network_report_results` (مهاجرت
 * `Phase3AnalysisResults1739400000000`). ستون‌ها **دقیقاً** با مهاجرت هم‌خوان‌اند.
 *
 *  - `network_id`        : ارجاع مفهومی به `networks.id` (integer ساده، بدون FK).
 *  - `analysis_run_id`   : ارجاع به `analysis_runs.id` (nullable).
 *  - `prompt_version_id` : نسخهٔ prompt استفاده‌شده (nullable).
 *  - `model`             : مدل OpenRouter استفاده‌شده (nullable).
 *  - `report` (jsonb)    : بدنهٔ کامل گزارش.
 *  - `period_start`/`period_end` : بازهٔ زمانی گزارش (nullable).
 */
@Entity('network_report_results')
export class NetworkReportResultEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  network_id: number;

  @Column({ type: 'int', nullable: true })
  analysis_run_id: number | null;

  @Column({ type: 'int', nullable: true })
  prompt_version_id: number | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'jsonb', nullable: true })
  report: NetworkReportOutput | null;

  @Column({ type: 'timestamp', nullable: true })
  period_start: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  period_end: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
