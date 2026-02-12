import { UserRole } from '@pos/shared-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column()
  name: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CASHIER })
  role: UserRole;

  // Organization relationship (nullable for SUPER_ADMIN)
  @Column({ nullable: true })
  @Index()
  organizationId: string;

  @ManyToOne('OrganizationEntity', 'users', { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization: any;

  @Column({ nullable: true })
  terminalId: string;

  @Column({ default: true })
  isActive: boolean;

  // Additional user metadata
  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
