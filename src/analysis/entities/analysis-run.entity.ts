import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnalysisRunStatus, AnalysisRunType } from '../analysis.types';

/**
 * موجودیت ردیابی یک اجرای تحلیل (AnalysisRun — design §6.3، Requirement 7.6).
 *
 * نگاشت به جدول `analysis_runs` که در مهاجرت افزایشی
 * `Phase3AnalysisResults1739400000000` ساخته شده است. ستون‌ها **دقیقاً** با آن
 * مهاجرت هم‌خوان‌اند (نام، نوع و nullable بودن):
 *
 *  - `type`        : نوع اجرا (`content` | `source_insight` | `network_report`).
 *  - `scope_ref`   : ارجاع مفهومی به موجودیت دامنه (sourceId/networkId) به‌صورت
 *                    رشته (varchar nullable) — هم‌خوان با ستون مهاجرت.
 *  - `timeframe`   : بازهٔ زمانی اجرا (در تحلیل source؛ nullable).
 *  - `status`      : وضعیت جاری/نهایی (`running`/`succeeded`/`failed`/`partial`).
 *  - `total`/`succeeded`/`failed` : شمارش‌ها با DEFAULT 0 (Requirement 7.6).
 *  - `started_at`/`finished_at`   : زمان شروع/پایان اجرا.
 *  - `triggered_by`: شناسهٔ کاربر آغازکننده (nullable).
 *  - `created_at`  : زمان ثبت.
 */
@Entity('analysis_runs')
export class AnalysisRunEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: AnalysisRunType;

  @Column({ type: 'varchar', nullable: true })
  scope_ref: string | null;

  @Column({ type: 'varchar', nullable: true })
  timeframe: string | null;

  @Column()
  status: AnalysisRunStatus;

  @Column({ type: 'int', default: 0 })
  total: number;

  @Column({ type: 'int', default: 0 })
  succeeded: number;

  @Column({ type: 'int', default: 0 })
  failed: number;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finished_at: Date | null;

  @Column({ type: 'int', nullable: true })
  triggered_by: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
