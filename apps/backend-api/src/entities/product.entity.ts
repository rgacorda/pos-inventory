import { ProductStatus } from '@pos/shared-types';
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

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  sku: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  taxRate: number;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ type: 'int', nullable: true })
  lowStockThreshold: number;

  @Column({ nullable: true })
  @Index()
  barcode: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status: ProductStatus;

  // Organization relationship for multi-tenancy
  @Column()
  @Index()
  organizationId: string;

  @ManyToOne('OrganizationEntity', 'products')
  @JoinColumn({ name: 'organizationId' })
  organization: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
