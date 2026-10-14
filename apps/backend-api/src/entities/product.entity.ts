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
  packPrice: number;

  @Column({ type: 'int', nullable: true })
  packQuantity: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  packMarkupPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  packMarkupFixed: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  halfPackPrice: number;

  @Column({ type: 'int', nullable: true })
  halfPackQuantity: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  halfPackMarkupPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  halfPackMarkupFixed: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  markupPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  markupFixed: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  addonPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  convenienceMarkupPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  convenienceMarkup: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  taxRate: number;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ type: 'int', nullable: true })
  lowStockThreshold: number;

  @Column({ nullable: true })
  @Index() // Non-unique index for faster barcode lookups
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

  /**
   * Last known supplier for this product, set automatically whenever a
   * RECEIVED inventory delivery (linked to a supplier) includes this
   * product. Nullable since existing products predate this field.
   */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  supplierId: string | null;

  @ManyToOne('Supplier', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplierId' })
  supplier: any;

  /**
   * Append-only log of edits made from the product form. Creating a product
   * does not add an entry.
   */
  @Column({ type: 'jsonb', nullable: true })
  editHistory: Array<{
    editedAt: string;
    editedByUserId: string | null;
    editedByName: string;
    changes: Array<{ label: string; from: string; to: string }>;
  }> | null;

  /** Edits at or before this time are acknowledged and hidden from the Edited label. */
  @Column({ type: 'timestamp', nullable: true })
  editHistoryDismissedAt: Date | null;

  /** Set when an admin archives the product. Hidden from Products and the POS until restored. */
  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deletedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deletedByName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
