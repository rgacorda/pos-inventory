import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OrderEntity } from './order.entity';

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_order_items_orderId')
  @Column()
  orderId: string;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @Column({ type: 'varchar', nullable: true })
  productId: string;

  // Product relation removed - manual items use string IDs that don't match products table
  // All product info (name, sku, price) is already stored in this table
  // If you need product details, query separately using productId (only for non-manual items)

  @Column()
  sku: string;

  @Column()
  name: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  /**
   * Unit cost when the line was saved. Profit and loss uses this so a later
   * change to the product cost does not rewrite the sale. Null on manual
   * lines and on rows not yet backfilled.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitCost: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  taxRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;
}
