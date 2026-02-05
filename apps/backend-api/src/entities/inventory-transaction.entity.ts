import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('inventory_transactions')
export class InventoryTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'enum', enum: ['IN', 'OUT', 'ADJUSTMENT'] })
  type: 'IN' | 'OUT' | 'ADJUSTMENT';

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ nullable: true })
  reference: string;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
