import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('supplier_incentives')
export class SupplierIncentive {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @Column({ type: 'uuid' })
  @Index()
  supplierId: string;

  @ManyToOne('Supplier', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier: any;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'timestamp' })
  @Index()
  incentiveDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
