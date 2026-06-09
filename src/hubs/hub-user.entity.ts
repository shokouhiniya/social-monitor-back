import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * HubUser — رابطهٔ کاربر و هاب با نقش درون‌هابی (design §3.1، §6).
 *
 * نگاشت به جدول `hub_users` (مهاجرت `CreateHubsAndHubUsers`). یک کاربر می‌تواند
 * در چند هاب نقش داشته باشد؛ `UNIQUE(hub_id, user_id)` تضمین می‌کند هر کاربر در
 * هر هاب حداکثر یک رکورد دارد. `HubScopeGuard` (فاز ۵) از همین جدول هاب‌های مجاز
 * کاربر را می‌خواند.
 */
@Entity('hub_users')
@Index('UQ_hub_users_hub_user', ['hub_id', 'user_id'], { unique: true })
export class HubUserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  hub_id: number;

  @Column({ type: 'int' })
  user_id: number;

  /** نقش کاربر درون این هاب (مثلاً hub_manager | hub_expert). */
  @Column({ type: 'varchar', nullable: true })
  role_in_hub: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
