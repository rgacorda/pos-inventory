import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Index,
} from 'typeorm';

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ unique: true })
  @Index()
  slug: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  taxId: string;

  // Business settings
  @Column({ type: 'json', nullable: true })
  settings: {
    currency?: string;
    timezone?: string;
    language?: string;
    taxRate?: number;
    features?: {
      inventory?: boolean;
      multipleTerminals?: boolean;
      reporting?: boolean;
      api?: boolean;
    };
  };

  @Column({ default: true })
  isActive: boolean;

  @OneToOne('SubscriptionEntity', 'organization')
  subscription: any;

  @OneToMany('UserEntity', 'organization')
  users: any[];

  @OneToMany('TerminalEntity', 'organization')
  terminals: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
