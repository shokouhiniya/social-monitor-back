import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * MicroMediaTag — برچسب آزاد و قابل کم/زیادکردن روی میکرورسانه (design §3.2).
 *
 * نگاشت به جدول `micro_media_tags`. `micro_media_id` با FK و ON DELETE CASCADE
 * (حذف میکرورسانه، برچسب‌هایش را پاک می‌کند).
 */
@Entity('micro_media_tags')
@Index('IDX_micro_media_tags_media', ['micro_media_id'])
@Index('IDX_micro_media_tags_tag', ['tag'])
export class MicroMediaTagEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  micro_media_id: number;

  @Column()
  tag: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;
}
