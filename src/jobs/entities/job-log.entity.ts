import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobLogLevel } from '../jobs.types';
import { JobEntity } from './job.entity';

/**
 * موجودیت لاگ یک Job (JobLog — design §6.7، Requirement 10.7/10.8).
 *
 * نگاشت به جدول `job_logs` (مهاجرت `Phase4Jobs1739500000000`). ستون‌ها **دقیقاً**
 * با مهاجرت هم‌خوان‌اند:
 *
 *  - `id`         : `SERIAL` (integer) PK.
 *  - `job_id`     : `uuid` با FK به `jobs(id)` و `ON DELETE CASCADE`.
 *  - `level`      : سطح لاگ (`info` | `success` | `error`).
 *  - `message`    : متن لاگ (`text`).
 *  - `created_at` : زمان ثبت.
 *
 * index روی `job_id` در همان مهاجرت ساخته شده است.
 */
@Entity('job_logs')
export class JobLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_job_logs_job_id')
  @Column({ type: 'uuid' })
  job_id: string;

  @Column()
  level: JobLogLevel;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @ManyToOne(() => JobEntity, (job) => job.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job?: JobEntity;
}
