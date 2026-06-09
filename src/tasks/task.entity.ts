import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Task — وظیفهٔ اجرایی انسانی محصول جدید (design §3.7، تصمیم ۳).
 *
 * نگاشت به جدول `tasks`. جدا از `action_plans` legacy (که AI-زده است). یک Task
 * می‌تواند بدون میکرورسانه باشد و روی hub/cluster/operation تعریف شود؛ اما باید
 * حداقل یکی از contextها را داشته باشد (Correctness Property 4 — اعتبارسنجی در
 * سرویس). ارجاع‌ها ستون integer ساده‌اند (FK نرم در مهاجرت).
 */
@Entity('tasks')
@Index('IDX_tasks_status', ['status'])
@Index('IDX_tasks_assignee', ['assignee_user_id'])
@Index('IDX_tasks_hub', ['hub_id'])
@Index('IDX_tasks_micro_media', ['micro_media_id'])
@Index('IDX_tasks_operation', ['operation_id'])
export class TaskEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** open | in_progress | done | cancelled. */
  @Column({ type: 'varchar', default: 'open' })
  status: string;

  /** low | normal | high | urgent. */
  @Column({ type: 'varchar', default: 'normal' })
  priority: string;

  @Column({ type: 'int', nullable: true })
  assignee_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  // --- contextها (حداقل یکی الزامی؛ MVP: hub برای taskهای عمومی) ---
  @Column({ type: 'int', nullable: true })
  hub_id: number | null;

  @Column({ type: 'int', nullable: true })
  micro_media_id: number | null;

  @Column({ type: 'int', nullable: true })
  cluster_id: number | null;

  @Column({ type: 'int', nullable: true })
  operation_id: number | null;

  @Column({ type: 'timestamp', nullable: true })
  due_date: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
