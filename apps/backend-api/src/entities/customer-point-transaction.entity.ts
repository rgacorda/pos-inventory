import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum PointTransactionType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  EXPIRE = 'EXPIRE',
}

@Entity('customer_point_transactions')
export class CustomerPointTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  customerId: string;

  @ManyToOne('CustomerEntity', 'pointTransactions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: any;

  @Column({ nullable: true })
  @Index()
  orderId: string;

  @ManyToOne('OrderEntity', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId' })
  order: any;

  @Column()
  @Index()
  organizationId: string;

  @ManyToOne('OrganizationEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: any;

  @Column({ type: 'enum', enum: PointTransactionType })
  type: PointTransactionType;

  @Column()
  points: number;

  @Column({ nullable: true, length: 500 })
  description: string;

  /** Date when this EARN transaction's points expire. Null = never expires. */
  @Column({ type: 'timestamp', nullable: true })
  @Index()
  expiresAt: Date;

  /** Set by the expiry cron when this EARN transaction has been processed and
   *  the corresponding points deducted from the customer balance. */
  @Column({ type: 'timestamp', nullable: true })
  expiredAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
