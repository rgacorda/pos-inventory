import { PaymentMethod, PaymentStatus } from '@pos/shared-types';
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

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  paymentNumber: string;

  @Column({ unique: true })
  @Index()
  posLocalId: string;

  @Column()
  @Index()
  orderId: string;

  @Column()
  @Index()
  terminalId: string;

  // Organization relationship for multi-tenancy
  @Column()
  @Index()
  organizationId: string;

  @ManyToOne('OrganizationEntity', 'payments')
  @JoinColumn({ name: 'organizationId' })
  organization: any;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  @Index()
  status: PaymentStatus;

  @Column({ nullable: true })
  reference: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
