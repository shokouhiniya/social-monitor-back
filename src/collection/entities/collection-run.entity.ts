import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { RawPayloadSummary } from '../collection.types';

/**
 * موجودیت `collection_run` — رکورد یک اجرای واکشی (design §5.5, §6 و
 * Requirement 4.5). برای هر فراخوانی `CollectionService.collect` یک رکورد ثبت
 * می‌شود که شمارش‌های واکشی (fetched/new/updated/error) و خلاصهٔ سبک payload را
 * نگه می‌دارد.
 *
 * جدول متناظر به‌صورت **افزایشی** در مهاجرت
 * `Phase2CollectionRun1739100000000` ساخته می‌شود (Requirement 13.2)؛ این entity
 * باید دقیقاً با آن مهاجرت هم‌خوان بماند (نوع‌ها و nullable بودن‌ها).
 *
 * نکتهٔ نگاشت (design §6.2 — Source = Page): `source_id` به شناسهٔ رکورد جدول
 * `pages` اشاره دارد. برای حفظ غیرتخریبی بودن و ساده‌ماندن مهاجرت، FK سخت‌گیرانه
 * تعریف نمی‌شود (ستون ساده integer) — مطابق رویکرد محتاطانهٔ گذار.
 */
@Entity('collection_run')
export class CollectionRun {
  @PrimaryGeneratedColumn()
  id: number;

  /** شناسهٔ منبع (page_id). */
  @Column({ type: 'int' })
  source_id: number;

  /** پلتفرم اجرا (`instagram`/`telegram`/`twitter`). */
  @Column({ type: 'varchar' })
  platform: string;

  /** وضعیت نهایی اجرا: `success` | `partial` | `failed`. */
  @Column({ type: 'varchar' })
  status: string;

  /** تعداد آیتم خام واکشی‌شده از provider. */
  @Column({ type: 'int', default: 0 })
  fetched_count: number;

  /** تعداد رکوردهای تازه درج‌شده. */
  @Column({ type: 'int', default: 0 })
  new_count: number;

  /** تعداد رکوردهای به‌روزرسانی‌شده. */
  @Column({ type: 'int', default: 0 })
  updated_count: number;

  /** تعداد خطاهای provider در این اجرا. */
  @Column({ type: 'int', default: 0 })
  error_count: number;

  /** تعداد آیتم‌های ردشده (فاقد فیلد ضروری یا تکراری درون‌دسته). */
  @Column({ type: 'int', default: 0 })
  skipped_count: number;

  /** پیام خطا (در صورت وجود) — دلایل طبقه‌بندی‌شده به‌صورت متن. */
  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  /**
   * خلاصهٔ سبک payload (Requirement 4.4) — به‌جای raw payload سنگین. تنها
   * متادیتای جمع‌بندی (شمارش‌ها، توزیع نوع، نمونهٔ external_id) ذخیره می‌شود.
   */
  @Column({ type: 'jsonb', nullable: true })
  raw_payload_summary: RawPayloadSummary | null;

  /** زمان شروع اجرا. */
  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  /** زمان پایان اجرا. */
  @Column({ type: 'timestamp', nullable: true })
  finished_at: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
