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

export type InventoryVarianceStatus = 'PENDING' | 'APPLIED';

/**
 * A physical stock count for one product. Stock on the product is unchanged
 * until an admin applies the count.
 */
@Entity('inventory_variance_counts')
@Index(['organizationId', 'productId', 'status'])
export class InventoryVarianceCount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @Column({ type: 'uuid' })
  @Index()
  productId: string;

  @ManyToOne('ProductEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: any;

  /** Quantity counted on the shelf. */
  @Column({ type: 'int' })
  countedQuantity: number;

  /** System stock when the count was saved, then the stock replaced when applied. */
  @Column({ type: 'int' })
  systemQuantity: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: InventoryVarianceStatus;

  @Column({ type: 'uuid' })
  countedByUserId: string;

  @Column({ type: 'uuid', nullable: true })
  appliedByUserId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  appliedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
