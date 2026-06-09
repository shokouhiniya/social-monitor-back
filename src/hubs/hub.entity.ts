import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Hub — ساختار مدیریتی/سازمانی محصول جدید میکرورسانه (design §3.1، تصمیم ۲).
 *
 * نگاشت به جدول `hubs` (مهاجرت `CreateHubsAndHubUsers`). Hub مستقل از `Network`
 * (شبکهٔ روایی) و `Cluster` (خوشهٔ موضوعی) است؛ نقش‌ها، دسترسی، فیلترها و
 * داشبوردها حول آن سازمان می‌یابند.
 *
 * نکتهٔ مرزی: `manager_user_id` ارجاع مفهومی به `users.id` است (FK نرم با
 * ON DELETE SET NULL در مهاجرت). همهٔ ستون‌های nullable نوع صریح دارند تا خطای
 * متادیتای TypeORM (`Data type "Object"`) رخ ندهد.
 */
@Entity('hubs')
export class HubEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', nullable: true })
  manager_user_id: number | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
