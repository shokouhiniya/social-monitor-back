import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
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
  target_pages: number[]; // page IDs to target

  @Column({ default: 'active' })
  status: string; // active, acknowledged, expired

  @Column()
  created_by: number; // user ID

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  created_at: Date;
}
