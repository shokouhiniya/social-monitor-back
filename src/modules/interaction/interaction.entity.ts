import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Page } from '../page/page.entity';
import { ActionPlan } from '../action-plan/action-plan.entity';

@Entity('interactions')
export class Interaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  page_id: number;

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

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
