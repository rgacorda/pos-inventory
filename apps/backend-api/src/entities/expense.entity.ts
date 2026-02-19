import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  type: 'ELECTRICITY' | 'INTERNET' | 'WATER' | 'WAGES' | 'RENT' | 'OTHER';

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'timestamp' })
  @Index()
  expenseDate: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient: string; // Employee name for wages, vendor for utilities

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNumber: string; // Invoice/bill number

  @Column({ type: 'text', nullable: true })
  receiptImageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
