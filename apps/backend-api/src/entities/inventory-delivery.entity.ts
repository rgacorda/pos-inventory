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

@Entity('inventory_deliveries')
export class InventoryDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  /**
   * Denormalized supplier name, kept for backward compatibility with
   * deliveries created before the `suppliers` table was linked here.
   * For new deliveries this is auto-populated from `supplierId`'s
   * supplier record so existing display/search code keeps working.
   */
  @Column()
  supplier: string;

  /**
   * FK to `suppliers.id`. Nullable so legacy deliveries (free-text
   * `supplier` only) remain valid without a migration backfill.
   */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  supplierId: string | null;

  @ManyToOne('Supplier', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplierId' })
  supplierEntity: any;

  @Column({ type: 'timestamp' })
  deliveryDate: Date;

  /**
   * Final total after `discountAmount` has been subtracted from the sum of
   * `items[].totalCost`. This is what reports/stats read, so it always
   * reflects what was actually paid to the supplier.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalCost: number;

  /**
   * Flat discount the supplier gave on this delivery (e.g. a promo or
   * loyalty discount), already subtracted out of `totalCost`. Kept
   * separately so it can be shown/audited on its own. Defaults to 0 for
   * deliveries created before this field existed.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'jsonb', nullable: true })
  items: Array<{
    productId: string;
    productName: string;
    /** Total individual units received, regardless of how it was entered (unit/pack/half-pack). */
    quantity: number;
    /** Cost per individual unit. Always 0 when `isFree` is true. */
    unitCost: number;
    /** Line total cost. Always 0 when `isFree` is true so free items don't affect the delivery total. */
    totalCost: number;
    /** True when the supplier gave this item for free; stock is still updated but cost is excluded. */
    isFree?: boolean;
    /** When true, the product's `cost` (and `price`, if markups are set) is synced to `unitCost`. */
    updateProductCost?: boolean;
    /** Present when the item was entered as packs/half-packs, for display/audit purposes only. */
    packInfo?: {
      type: 'PACK' | 'HALF_PACK';
      packs: number;
      unitsPerPack: number;
    };
  }>;

  @Column({ type: 'varchar', length: 50, default: 'RECEIVED' })
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  invoiceNumber: string;

  @Column({ type: 'text', nullable: true })
  receiptImageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
