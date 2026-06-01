import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobStatus } from '../job-state-machine';
import { JobScope, JobType } from '../jobs.types';
import { JobTaskEntity } from './job-task.entity';
import { JobLogEntity } from './job-log.entity';

/**
 * موجودیت یک اجرای دسته‌ای (Job — design §6.7، Requirement 10.1).
 *
 * نگاشت به جدول `jobs` که در مهاجرت افزایشی `Phase4Jobs1739500000000` ساخته شده
 * است. ستون‌ها **دقیقاً** با آن مهاجرت هم‌خوان‌اند (نام، نوع و nullable بودن):
 *
 *  - `id`              : `uuid` با مقدار پیش‌فرض `gen_random_uuid()` (PK).
 *  - `type`            : نوع Job (مثلاً `refresh`).
 *  - `status`          : وضعیت جاری/نهایی (یکی از `JOB_STATUSES`).
 *  - `scope`           : دامنهٔ مفهومی اجرا (nullable).
 *  - `config`          : پارامترهای اجرا (`jsonb` nullable) — مثلاً sourceIds/steps.
 *  - `total_tasks`/`completed_tasks`/`failed_tasks` : شمارش‌ها با DEFAULT 0.
 *  - `created_by`      : شناسهٔ کاربر آغازکننده (integer nullable).
 *  - `created_at`/`started_at`/`finished_at` : زمان ثبت/شروع/پایان.
 */
@Entity('jobs')
export class JobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: JobType;

  @Column()
  status: JobStatus;

  @Column({ nullable: true })
  scope: string | null;

  @Column({ type: 'jsonb', nullable: true })
  config: JobScope | null;

  @Column({ type: 'int', default: 0 })
  total_tasks: number;

  @Column({ type: 'int', default: 0 })
  completed_tasks: number;

  @Column({ type: 'int', default: 0 })
  failed_tasks: number;

  @Column({ type: 'int', nullable: true })
  created_by: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finished_at: Date | null;

  @OneToMany(() => JobTaskEntity, (task) => task.job)
  tasks?: JobTaskEntity[];

  @OneToMany(() => JobLogEntity, (log) => log.job)
  logs?: JobLogEntity[];
}
