import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Page } from '../page/page.entity';

@Entity('action_plans')
export class ActionPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  page_id: number;

  @ManyToOne(() => Page)
  @JoinColumn({ name: 'page_id' })
  page: Page;

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

  @Column({ default: false })
  is_ai_generated: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updated_at: Date;
}
