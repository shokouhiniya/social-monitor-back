import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('strategic_alerts')
export class StrategicAlert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ nullable: true })
  priority: string; // critical, high, medium, low

  @Column({ nullable: true })
  category: string; // silence_gap, trend_shift, crisis, opportunity

  @Column({ type: 'jsonb', nullable: true })
  target_pages: number[];

  @Column({ default: 'active' })
  status: string; // active, investigating, needs_response, acknowledged, archived

  @Column()
  created_by: number;

  @Column({ nullable: true })
  assigned_to: string;

  @Column({ type: 'float', default: 0 })
  impact_radius: number; // percentage of network reach affected

  @Column({ type: 'int', default: 0 })
  involved_pages_count: number;

  @Column({ type: 'jsonb', nullable: true })
  playbook: string[]; // suggested tactical actions

  @Column({ nullable: true })
  evidence_url: string;

  @Column({ nullable: true })
  group_key: string; // for grouping related alerts

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updated_at: Date;
}
