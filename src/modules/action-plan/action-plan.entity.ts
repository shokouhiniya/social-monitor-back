import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Page } from '../page/page.entity';
import { StrategicAlert } from '../strategic-alert/strategic-alert.entity';
import { Interaction } from '../interaction/interaction.entity';

@Entity('action_plans')
export class ActionPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  page_id: number;

  @ManyToOne(() => Page, { nullable: true })
  @JoinColumn({ name: 'page_id' })
  page: Page;

  @Column({ type: 'int', nullable: true })
  cluster_id: number;

  @Column({ nullable: true })
  alert_id: number;

  @ManyToOne(() => StrategicAlert, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'alert_id' })
  alert: StrategicAlert;

  @OneToMany(() => Interaction, (interaction) => interaction.action_plan)
  interactions: Interaction[];

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'todo' })
  status: string; // todo, in_progress, done, cancelled

  @Column({ type: 'int', default: 0 })
  priority: number; // 0=low, 1=medium, 2=high, 3=urgent

  @Column({ nullable: true })
  category: string; // reply_comments, change_bio, publish_post, publish_story, etc.

  @Column({ nullable: true })
  suggested_content: string;

  @Column({ nullable: true })
  suggested_tone: string; // empathetic, formal, casual, admiring

  @Column({ type: 'timestamp', nullable: true })
  due_date: Date;

  @Column({ nullable: true })
  assigned_to: string;

  @Column({ type: 'jsonb', nullable: true })
  contact_info: {
    phone?: string;
    email?: string;
    telegram?: string;
    notes?: string;
    [key: string]: any;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  recommended_pages: number[] | null; // suggested page IDs to engage in this operation

  @Column({ default: false })
  is_ai_generated: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updated_at: Date;
}
