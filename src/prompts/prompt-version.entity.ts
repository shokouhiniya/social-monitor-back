import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PromptResponseFormat } from '../ai/ai.types';
import { PromptDefinition } from './prompt-definition.entity';

/**
 * موجودیت یک نسخهٔ Prompt (PromptVersion — design §5.7 / §6.4،
 * Requirement 6.2/6.3).
 *
 * نگاشت به جدول `prompt_versions` که در مهاجرت افزایشی
 * `Phase3PromptAi1739300000000` ساخته شده است. ستون‌ها باید **دقیقاً** با آن
 * مهاجرت هم‌خوان بمانند (نام، نوع و nullable بودن):
 *
 *  - `prompt_definition_id`: FK به `prompt_definitions` (الزامی، ON DELETE CASCADE).
 *  - `version`: شمارهٔ نسخهٔ افزایشی **به‌ازای هر prompt** (الزامی — Requirement 6.2).
 *  - `template`: متن تمپلیت با placeholder ها (الزامی, text).
 *  - `extra_instructions`: دستورات تکمیلی اختیاری (text, nullable).
 *  - `model`: مدل OpenRouter این نسخه (nullable).
 *  - `temperature`: دمای نمونه‌گیری (double precision, nullable).
 *  - `response_format`: قالب پاسخ (`json`/`text`, nullable).
 *  - `created_by`: شناسهٔ کاربر سازنده (nullable).
 *  - `created_at`: زمان ثبت.
 *  - `is_active`: تنها یک نسخه به‌ازای هر prompt فعال است (پیش‌فرض false —
 *    Requirement 6.3).
 */
@Entity('prompt_versions')
export class PromptVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_prompt_versions_prompt_definition_id')
  @Column({ type: 'int' })
  prompt_definition_id: number;

  @ManyToOne(() => PromptDefinition, (definition) => definition.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'prompt_definition_id' })
  definition: PromptDefinition;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'text' })
  template: string;

  @Column({ type: 'text', nullable: true })
  extra_instructions: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'double precision', nullable: true })
  temperature: number | null;

  @Column({ type: 'varchar', nullable: true })
  response_format: PromptResponseFormat | null;

  @Column({ type: 'int', nullable: true })
  created_by: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @Column({ type: 'boolean', default: false })
  is_active: boolean;
}
