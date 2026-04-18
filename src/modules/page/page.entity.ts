import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Post } from '../post/post.entity';
import { FieldReport } from '../field-report/field-report.entity';

@Entity('pages')
export class Page {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  platform: string; // instagram, telegram, twitter, etc.

  @Column({ nullable: true })
  category: string; // blogger, news, activist, lifestyle, etc.

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  language: string;

  @Column({ type: 'int', default: 0 })
  followers_count: number;

  @Column({ type: 'int', default: 0 })
  following_count: number;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  profile_image_url: string;

  @Column({ nullable: true })
  cluster: string; // semantic cluster label

  @Column({ type: 'float', default: 0 })
  credibility_score: number;

  @Column({ type: 'float', default: 0 })
  influence_score: number;

  @Column({ type: 'float', default: 0 })
  consistency_rate: number;

  @Column({ type: 'jsonb', nullable: true })
  persona_radar: Record<string, number>; // 6-axis: aggressive/defensive, producer/resharer, visual/textual, formal/informal, local/global, interactive/one-way

  @Column({ type: 'jsonb', nullable: true })
  pain_points: string[]; // top 3 concerns

  @Column({ type: 'jsonb', nullable: true })
  keywords: string[];

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_fetched_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_processed_at: Date;

  @OneToMany(() => Post, (post) => post.page)
  posts: Post[];

  @OneToMany(() => FieldReport, (report) => report.page)
  field_reports: FieldReport[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updated_at: Date;
}
