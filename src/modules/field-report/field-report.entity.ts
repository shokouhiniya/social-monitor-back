import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Page } from '../page/page.entity';

@Entity('field_reports')
export class FieldReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  page_id: number;

  @ManyToOne(() => Page, (page) => page.field_reports, { nullable: true })
  @JoinColumn({ name: 'page_id' })
  page: Page;

  @Column()
  reporter_id: number; // user who submitted

  @Column({ type: 'text' })
  content: string; // transcribed text or manual input

  @Column({ nullable: true })
  source_type: string; // voice, file, manual

  @Column({ nullable: true })
  file_url: string;

  @Column({ type: 'jsonb', nullable: true })
  extracted_keywords: string[];

  @Column({ nullable: true })
  sentiment: string; // extracted sentiment from report

  @Column({ type: 'boolean', default: false })
  is_override: boolean; // human analysis override

  @Column({ type: 'text', nullable: true })
  override_note: string;

  @Column({ default: 'pending' })
  status: string; // pending, processed, archived

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
