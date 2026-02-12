import { SubscriptionPlan, SubscriptionStatus } from '@pos/shared-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity('subscriptions')
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @OneToOne('OrganizationEntity', 'subscription')
  @JoinColumn({ name: 'organizationId' })
  organization: any;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  status: SubscriptionStatus;

  // Billing information
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  monthlyPrice: number;

  @Column({ nullable: true })
  billingCycle: string; // 'monthly' | 'yearly'

  @Column({ nullable: true })
  paymentMethod: string;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  stripeSubscriptionId: string;

  // Limits based on plan
  @Column({ type: 'json' })
  limits: {
    maxUsers: number;
    maxTerminals: number;
    maxProducts: number;
    maxTransactionsPerMonth: number;
    features: {
      multipleLocations: boolean;
      advancedReporting: boolean;
      apiAccess: boolean;
      prioritySupport: boolean;
    };
  };

  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
