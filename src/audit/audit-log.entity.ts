import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * موجودیت رکورد ممیزی سبک (Requirement 11.5 / design §6.9).
 *
 * نگاشت به جدول جدید `audit_logs` که در مهاجرت افزایشی
 * `Phase3AuthAudit1739200000000` ساخته می‌شود. ستون‌ها باید دقیقاً با آن مهاجرت
 * هم‌خوان بمانند.
 *
 *  - `actor_user_id`: شناسهٔ کاربری که اقدام را انجام داده (nullable؛ FK به
 *    users با ON DELETE SET NULL).
 *  - `action`: نوع اقدام حساس (مثلاً `source.create`).
 *  - `entity_type` / `entity_id`: موجودیت هدف (nullable).
 *  - `meta`: جزئیات اختیاری به‌صورت jsonb.
 *  - `created_at`: زمان ثبت.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_audit_logs_actor_user_id')
  @Column({ type: 'int', nullable: true })
  actor_user_id: number | null;

  @Column()
  action: string;

  @Column({ nullable: true })
  entity_type: string | null;

  @Column({ nullable: true })
  entity_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
