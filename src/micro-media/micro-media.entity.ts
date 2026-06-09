import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * MicroMedia — واحد مرکزی محصول جدید (design §3.2، تصمیم ۱).
 *
 * نگاشت به جدول `micro_media` (مهاجرت `CreateMicroMedia`). هر میکرورسانه می‌تواند
 * چند «حساب پلتفرمی» (`pages`) داشته باشد (`micro_media 1..N pages`). موجودیت
 * `pages` بازتعریف نمی‌شود؛ تنها ستون `micro_media_id` به آن افزوده می‌شود.
 *
 * ارجاع‌های `hub_id` و `topic_cluster_id` به‌صورت ستون integer ساده نگه داشته
 * می‌شوند (FK نرم با ON DELETE SET NULL در مهاجرت) — هم‌راستا با رویکرد decoupled
 * موجود کدبیس. همهٔ ستون‌های nullable نوع صریح دارند (درس As-Is).
 */
@Entity('micro_media')
export class MicroMediaEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_micro_media_hub_id')
  @Column({ type: 'int', nullable: true })
  hub_id: number | null;

  @Column()
  name: string;

  /** هویت/کیستی رسانه. */
  @Column({ type: 'varchar', nullable: true })
  identity_title: string | null;

  @Column({ type: 'text', nullable: true })
  identity_description: string | null;

  /** حوزهٔ فعالیت. */
  @Column({ type: 'varchar', nullable: true })
  activity_domain: string | null;

  // --- اطلاعات تماس ---
  @Column({ type: 'varchar', nullable: true })
  contact_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  contact_phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  contact_email: string | null;

  @Column({ type: 'text', nullable: true })
  contact_notes: string | null;

  // --- مشخصات هویتی/جمعیت‌شناختی ---
  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'varchar', nullable: true })
  nationality: string | null;

  @Column({ type: 'varchar', nullable: true })
  language: string | null;

  @Column({ type: 'varchar', nullable: true })
  religion: string | null;

  @Column({ type: 'varchar', nullable: true })
  gender: string | null;

  @Column({ type: 'varchar', nullable: true })
  age_group: string | null;

  /** خوشهٔ موضوعی — ارجاع مفهومی به `clusters.id`. */
  @Column({ type: 'int', nullable: true })
  topic_cluster_id: number | null;

  /** وضعیت میکرورسانه: active | inactive | archived. */
  @Column({ type: 'varchar', default: 'active' })
  status: string;

  /** سطح اهمیت: عادی | راهبردی | قله و ... (آزاد). */
  @Column({ type: 'varchar', nullable: true })
  importance_level: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updated_at: Date;
}
