import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../user.entity';

@Entity('user_permissions')
export class UserPermissions {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'int', unique: true })
  userId: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'boolean', default: true })
  canManagePower: boolean;

  @Column({ type: 'boolean', default: true })
  canAccessConsole: boolean;

  @Column({ type: 'boolean', default: true })
  canViewMetrics: boolean;

  @Column({ type: 'boolean', default: true })
  canViewDetails: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
