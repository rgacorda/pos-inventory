import { OrderStatus } from '@pos/shared-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderItemEntity } from './order-item.entity';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  orderNumber: string;

  @Column({ unique: true })
  @Index()
  posLocalId: string;

  @Column({ nullable: true })
  @Index()
  terminalId: string;

  @ManyToOne('TerminalEntity', 'orders')
  @JoinColumn({ name: 'terminalId' })
  terminal: any;

  @Column({ nullable: true })
  cashierId: string;

  @ManyToOne('UserEntity', 'orders')
  @JoinColumn({ name: 'cashierId' })
  cashier: any;

  @Column({ nullable: true })
  customerName: string;

  @Column({ nullable: true })
  customerAddress: string;

  @Column({ nullable: true })
  @Index()
  customerId: string;

  @ManyToOne('CustomerEntity', { nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: any;

  @Column({ type: 'int', nullable: true })
  pointsEarned: number;

  @Column({ type: 'int', nullable: true })
  pointsRedeemed: number;

  // Organization relationship for multi-tenancy
  @Column()
  @Index()
  organizationId: string;

  @ManyToOne('OrganizationEntity', 'orders')
  @JoinColumn({ name: 'organizationId' })
  organization: any;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  @Index()
  status: OrderStatus;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  syncedAt: Date;

  @Column({ nullable: true })
  voidedBy: string;

  @ManyToOne('UserEntity', { nullable: true })
  @JoinColumn({ name: 'voidedBy' })
  voider: any;

  @Column({ type: 'timestamp', nullable: true })
  voidedAt: Date;

  @Column({ nullable: true })
  @Index()
  exchangeRef: string;

  @Column({ type: 'timestamp', nullable: true })
  exchangedAt: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.order, { cascade: true })
  items: OrderItemEntity[];

  @OneToMany('PaymentEntity', 'order')
  payments: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
