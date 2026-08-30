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

export interface InventoryReturnItem {
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

@Entity('inventory_returns')
export class InventoryReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @Column()
  supplier: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  supplierId: string | null;

  @ManyToOne('Supplier', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplierId' })
  supplierEntity: any;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  deliveryId: string | null;

  @ManyToOne('InventoryDelivery', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deliveryId' })
  delivery: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 50, default: 'NOT_RESOLVED' })
  status: 'NOT_RESOLVED' | 'RESOLVED';

  @Column({ type: 'jsonb', default: [] })
  returnedItems: InventoryReturnItem[];

  @Column({ type: 'jsonb', nullable: true })
  replacementItems: InventoryReturnItem[] | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  returnedTotalCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  replacementTotalCost: number | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
