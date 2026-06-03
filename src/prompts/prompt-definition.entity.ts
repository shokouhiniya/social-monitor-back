import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OutputSchemaDescriptor } from '../ai/ai.types';
import { PromptVersion } from './prompt-version.entity';

/**
 * موجودیت تعریف یک Prompt (PromptDefinition — design §5.7 / §6.4،
 * Requirement 6.1/6.8).
 *
 * نگاشت به جدول `prompt_definitions` که در مهاجرت افزایشی
 * `Phase3PromptAi1739300000000` ساخته شده است. ستون‌ها باید **دقیقاً** با آن
 * مهاجرت هم‌خوان بمانند (نام، نوع و nullable بودن):
 *
 *  - `key`: شناسهٔ پایدار و یکتای prompt (مثلاً `content_analysis`).
 *  - `title`: عنوان انسانی‌خوان (الزامی).
 *  - `description`: توضیح اختیاری (text, nullable).
 *  - `category`: دستهٔ منطقی prompt (nullable) برای گروه‌بندی در UI.
 *  - `default_model`: مدل پیش‌فرض پیشنهادی برای نسخه‌های جدید (nullable).
 *  - `output_schema`: توصیف‌گر schema خروجی برای اعتبارسنجی (jsonb, nullable).
 *  - `is_active`: فعال/غیرفعال بودن prompt (پیش‌فرض true — Requirement 6.8).
 *  - `created_at` / `updated_at`: زمان ثبت و آخرین به‌روزرسانی.
 *
 * هر تعریف می‌تواند چند `PromptVersion` داشته باشد (نسخه‌بندی افزایشی —
 * Requirement 6.2) که تنها یکی از آن‌ها فعال است (Requirement 6.3).
 */
@Entity('prompt_definitions')
export class PromptDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('UQ_prompt_definitions_key', { unique: true })
  @Column()
  key: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  default_model: string | null;

  @Column({ type: 'jsonb', nullable: true })
  output_schema: OutputSchemaDescriptor | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => PromptVersion, (version) => version.definition)
  versions: PromptVersion[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
