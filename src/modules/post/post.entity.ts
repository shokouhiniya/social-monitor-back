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

  @Column({ nullable: true })
  original_source: string; // if reshared, from which page

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
