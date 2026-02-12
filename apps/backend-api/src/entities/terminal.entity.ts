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
import { OrganizationEntity } from './organization.entity';

@Entity('terminals')
export class TerminalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  terminalId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  location: string;

  @Column()
  @Index()
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.terminals)
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
