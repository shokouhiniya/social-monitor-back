import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Operation (Campaign) — کمپین/عملیات محصول جدید (design §3.8، تصمیم ۴).
 *
 * نگاشت به جدول `operations`. در سطح HTTP زیر مسیر `/campaigns` ارائه می‌شود
 * (تداخل صفر با کنترلرهای legacy روی `/operations/*`)، اما در UI با عنوان
 * «عملیات» نمایش داده می‌شود. مجموعه‌ای از میکرورسانه‌ها (`operation_media`) و
 * تسک‌ها (`tasks.operation_id`) و خروجی‌ها (`operation_outputs`) دارد.
 */
@Entity('operations')
export class OperationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  goal: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** draft | active | completed | cancelled. */
  @Column({ type: 'varchar', default: 'draft' })
  status: string;

  @Column({ type: 'int', nullable: true })
  owner_user_id: number | null;

  @Column({ type: 'timestamp', nullable: true })
  starts_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  ends_at: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
