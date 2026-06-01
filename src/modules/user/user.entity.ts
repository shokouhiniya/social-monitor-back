import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true, nullable: false })
  phone: string;

  // === ستون‌های افزایشی فاز ۳ (Auth/Users — Requirement 11) ===
  // این ستون‌ها به‌صورت nullable از طریق مهاجرت Phase3AuthAudit افزوده شده‌اند
  // (مانند الگوی تسک ۳.۴ که profile_url/network_id را به page.entity افزود).
  // موجودیت `User` متعلق به ماژول legacy است اما مالک واحد جدول `users` است؛
  // بنابراین ستون‌های جدید همین‌جا اعلام می‌شوند تا هم کد legacy و هم کد جدید
  // (UsersService/AuthService) آن‌ها را ببینند و هیچ entity دومی روی `users`
  // تعریف نشود.

  /** نقش کاربر — یکی از admin/operator/viewer (Requirement 11.3). پیش‌فرض viewer. */
  @Column({ nullable: true, default: 'viewer' })
  role: string;

  /** نام کاربری برای login (nullable برای سازگاری با رکوردهای legacy). */
  @Column({ nullable: true })
  username: string | null;

  /** هش رمز عبور (هرگز خود رمز ذخیره نمی‌شود). nullable برای رکوردهای legacy. */
  @Column({ nullable: true })
  password_hash: string | null;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updated_at: Date;
}
