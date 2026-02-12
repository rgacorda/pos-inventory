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
import { UserEntity } from './user.entity';
import { SubscriptionEntity } from './subscription.entity';
import { TerminalEntity } from './terminal.entity';

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

  @OneToOne(
    () => SubscriptionEntity,
    (subscription) => subscription.organization,
  )
  subscription: SubscriptionEntity;

  @OneToMany(() => UserEntity, (user) => user.organization)
  users: UserEntity[];

  @OneToMany(() => TerminalEntity, (terminal) => terminal.organization)
  terminals: TerminalEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
