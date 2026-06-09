import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * OperationMedia — رابطهٔ یک میکرورسانه با یک عملیات (design §3.8).
 *
 * نگاشت به جدول `operation_media`. `UNIQUE(operation_id, micro_media_id)` از
 * انتخاب تکراری جلوگیری می‌کند. هر دو FK با ON DELETE CASCADE.
 */
@Entity('operation_media')
@Index('UQ_operation_media_op_media', ['operation_id', 'micro_media_id'], {
  unique: true,
})
export class OperationMediaEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  operation_id: number;

  @Column({ type: 'int' })
  micro_media_id: number;

  @Column({ type: 'text', nullable: true })
  planned_action: string | null;

  @Column({ type: 'text', nullable: true })
  expected_output: string | null;

  @Column({ type: 'text', nullable: true })
  actual_output: string | null;

  /** selected | assigned | in_progress | published | completed | failed. */
  @Column({ type: 'varchar', default: 'selected' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
