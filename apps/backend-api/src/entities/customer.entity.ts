import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';

@Entity('customers')
@Unique(['organizationId', 'phone'])
export class CustomerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  organizationId: string;

  @ManyToOne('OrganizationEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: any;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 50 })
  @Index()
  phone: string;

  @Column({ default: 0 })
  totalPoints: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalSpent: number;

  @OneToMany('CustomerPointTransactionEntity', 'customer')
  pointTransactions: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
