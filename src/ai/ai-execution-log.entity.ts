import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiExecutionStatus, AiUsage } from './ai.types';

/**
 * موجودیت لاگ اجرای AI (Requirement 5.6 / design §6.4 و §11.2).
 *
 * نگاشت به جدول جدید `ai_execution_logs` که در مهاجرت افزایشی
 * `Phase3PromptAi1739300000000` ساخته می‌شود. ستون‌ها باید **دقیقاً** با آن
 * مهاجرت هم‌خوان بمانند (نام، نوع و nullable بودن):
 *
 *  - `prompt_key`: شناسهٔ پایدار prompt اجراشده (الزامی).
 *  - `prompt_version_id`: نسخهٔ prompt در صورت در دسترس بودن (nullable).
 *  - `model`: شناسهٔ مدل OpenRouter استفاده‌شده (nullable).
 *  - `input_summary`: خلاصه/برش کوتاه از ورودی رندرشده (nullable, text).
 *  - `input_hash`: هش پایدار (sha256) ورودی برای ردیابی/دِدوپ (nullable).
 *  - `raw_input` / `raw_output`: متن خام prompt و پاسخ مدل (nullable, text).
 *  - `parsed_output`: خروجی parse‌شده در صورت موفقیت (nullable, jsonb).
 *  - `status`: وضعیت نرمال‌شدهٔ اجرا (الزامی).
 *  - `error_message`: پیام خطای انسانی‌خوان در حالت خطا (nullable, text).
 *  - `duration_ms`: مدت اجرا به میلی‌ثانیه (nullable).
 *  - `token_usage`: آمار مصرف توکن (nullable, jsonb).
 *  - `cost_estimate`: برآورد هزینه در صورت ارائه توسط provider (nullable, float).
 *  - `entity_type` / `entity_id`: ارجاع اختیاری به موجودیت دامنه (nullable).
 *  - `created_at`: زمان ثبت.
 *
 * `entity_id` به‌صورت `varchar` نگه داشته می‌شود تا با انواع مختلف شناسهٔ
 * موجودیت سازگار بماند (هم‌راستا با مهاجرت).
 */
@Entity('ai_execution_logs')
export class AiExecutionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_ai_execution_logs_prompt_key')
  @Column()
  prompt_key: string;

  @Column({ type: 'int', nullable: true })
  prompt_version_id: number | null;

  @Column({ nullable: true })
  model: string | null;

  @Column({ type: 'text', nullable: true })
  input_summary: string | null;

  @Column({ nullable: true })
  input_hash: string | null;

  @Column({ type: 'text', nullable: true })
  raw_input: string | null;

  @Column({ type: 'text', nullable: true })
  raw_output: string | null;

  @Column({ type: 'jsonb', nullable: true })
  parsed_output: unknown | null;

  @Column()
  status: AiExecutionStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'int', nullable: true })
  duration_ms: number | null;

  @Column({ type: 'jsonb', nullable: true })
  token_usage: AiUsage | null;

  @Column({ type: 'double precision', nullable: true })
  cost_estimate: number | null;

  @Column({ nullable: true })
  entity_type: string | null;

  @Column({ nullable: true })
  entity_id: string | null;

  @Index('IDX_ai_execution_logs_created_at')
  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
