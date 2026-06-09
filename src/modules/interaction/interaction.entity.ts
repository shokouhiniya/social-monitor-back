import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Page } from '../page/page.entity';
import { ActionPlan } from '../action-plan/action-plan.entity';

@Entity('interactions')
export class Interaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  page_id: number | null;

  @ManyToOne(() => Page)
  @JoinColumn({ name: 'page_id' })
  page: Page;

  @Column({ nullable: true })
  action_plan_id: number;

  @ManyToOne(() => ActionPlan, (ap) => ap.interactions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'action_plan_id' })
  action_plan: ActionPlan;

  @Column()
  type: string; // direct, phone, meeting, email, comment

  @Column()
  result: string; // success, failed

  @Column()
  responsible: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  // === micromedia-transformation §3.6 — ستون‌های افزایشی (nullable) ===
  // از طریق مهاجرت ExtendInteractionsForMicroMedia افزوده شده‌اند تا تعامل بتواند
  // به micro_media/hub/operation/task وصل شود و قاعدهٔ «فعال بودن» از
  // interaction_date محاسبه شود. همهٔ نوع‌ها صریح‌اند (درس As-Is).
  @Column({ type: 'int', nullable: true })
  micro_media_id: number | null;

  @Column({ type: 'int', nullable: true })
  hub_id: number | null;

  @Column({ type: 'int', nullable: true })
  operation_id: number | null;

  @Column({ type: 'int', nullable: true })
  task_id: number | null;

  @Column({ type: 'timestamp', nullable: true })
  interaction_date: Date | null;

  @Column({ type: 'int', nullable: true })
  owner_user_id: number | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  next_action: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
