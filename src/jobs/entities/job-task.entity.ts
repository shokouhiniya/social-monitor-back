import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobTaskStatus } from '../job-state-machine';
import { JobTaskType } from '../jobs.types';
import { JobEntity } from './job.entity';

/**
 * موجودیت یک واحد کاری زیرمجموعهٔ یک Job (JobTask — design §6.7، Requirement 10.1).
 *
 * نگاشت به جدول `job_tasks` (مهاجرت `Phase4Jobs1739500000000`). ستون‌ها **دقیقاً**
 * با مهاجرت هم‌خوان‌اند:
 *
 *  - `id`            : `SERIAL` (integer) PK.
 *  - `job_id`        : `uuid` با FK به `jobs(id)` و `ON DELETE CASCADE`.
 *  - `type`          : نوع کار (`fetch` | `analyze` | `insight` | `dashboard`).
 *  - `target_ref`    : ارجاع مفهومی به موجودیت هدف (مثلاً sourceId به‌صورت رشته؛ nullable).
 *  - `status`        : وضعیت جاری/نهایی (یکی از `JOB_STATUSES`).
 *  - `attempts`      : تعداد تلاش‌ها (DEFAULT 0).
 *  - `error_message` : پیام خطا در صورت شکست (`text` nullable).
 *  - `started_at`/`finished_at`/`created_at` : زمان‌ها.
 *
 * indexها روی `job_id` و `status` در همان مهاجرت ساخته شده‌اند؛ اینجا با
 * `@Index` نام‌گذاری‌نشده اعلام می‌شوند تا metadata هم‌خوان بماند (schema تنها از
 * طریق migration تغییر می‌کند).
 */
@Entity('job_tasks')
export class JobTaskEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_job_tasks_job_id')
  @Column({ type: 'uuid' })
  job_id: string;

  @Column()
  type: JobTaskType;

  @Column({ nullable: true })
  target_ref: string | null;

  @Index('IDX_job_tasks_status')
  @Column()
  status: JobTaskStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finished_at: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @ManyToOne(() => JobEntity, (job) => job.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job?: JobEntity;
}
