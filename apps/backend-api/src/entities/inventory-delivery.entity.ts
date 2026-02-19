import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('inventory_deliveries')
export class InventoryDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @Column()
  supplier: string;

  @Column({ type: 'timestamp' })
  deliveryDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalCost: number;

  @Column({ type: 'jsonb', nullable: true })
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;

  @Column({ type: 'varchar', length: 50, default: 'RECEIVED' })
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  invoiceNumber: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
