import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * TaskTag — برچسب آزاد روی تسک (design §3.7).
 *
 * نگاشت به جدول `task_tags`. `task_id` با FK و ON DELETE CASCADE. تگ‌های پیشنهادی
 * اولیه: operation, analysis, outreach, mentoring, identification, follow_up,
 * content, service (آزاد و قابل کم/زیادکردن).
 */
@Entity('task_tags')
@Index('IDX_task_tags_task', ['task_id'])
@Index('IDX_task_tags_tag', ['tag'])
export class TaskTagEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  task_id: number;

  @Column()
  tag: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
