import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Page } from '../page/page.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  page_id: number;

  @ManyToOne(() => Page, (page) => page.posts)
  @JoinColumn({ name: 'page_id' })
  page: Page;

  @Column({ nullable: true })
  external_id: string; // ID from the source platform

  @Column({ nullable: true })
  shortcode: string; // Instagram shortcode for URL (e.g., CXxxx)

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column({ type: 'text', nullable: true })
  caption_fa: string; // Farsi translation of caption (for non-Farsi posts)

  @Column({ nullable: true })
  post_type: string; // image, video, reel, story, carousel

  @Column({ nullable: true })
  media_url: string;

  @Column({ type: 'int', default: 0 })
  likes_count: number;

  @Column({ type: 'int', default: 0 })
  comments_count: number;

  @Column({ type: 'int', default: 0 })
  shares_count: number;

  @Column({ type: 'int', default: 0 })
  views_count: number;

  @Column({ type: 'float', nullable: true })
  sentiment_score: number; // -1 to 1

  @Column({ nullable: true })
  sentiment_label: string; // angry, hopeful, neutral, sad

  @Column({ type: 'jsonb', nullable: true })
  extracted_keywords: string[];

  @Column({ type: 'jsonb', nullable: true })
  extracted_topics: string[];

  @Column({ type: 'boolean', default: false })
  is_reshare: boolean;

  @Column({ type: 'boolean', default: true })
  is_relevant: boolean; // For filtered channels (keyword-based)

  @Column({ nullable: true })
  original_source: string; // if reshared, from which page

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date;

  @Column({ nullable: true })
  coverage_type: string; // How non-official sources cover the client: quote, criticism, praise, neutral_mention, analysis, interview, report

  @Column({ type: 'text', nullable: true })
  transcription: string | null; // Audio/video transcription text (from Soniox)

  @Column({ type: 'text', nullable: true })
  transcription_fa: string | null; // Farsi translation of transcription (for non-Farsi audio)

  @Column({ type: 'text', nullable: true })
  ocr_text: string | null; // On-screen text extracted from post image via LLM vision

  @Column({ type: 'text', nullable: true })
  ocr_text_fa: string | null; // Farsi translation of on-screen text (for non-Farsi text)

  @Column({ type: 'text', nullable: true })
  manual_context: string | null; // Human-provided context about the post content (what's in the video/image)

  @Column({ type: 'boolean', default: false })
  is_transcribed: boolean; // Whether transcription has been attempted

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
