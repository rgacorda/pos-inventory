import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { TerminalEntity } from './entities/terminal.entity';
import { ProductEntity } from './entities/product.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import * as bcrypt from 'bcrypt';
import {
  UserRole,
  ProductStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@pos/shared-types';

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    logger.log('Starting database seed...');

    // Seed Super Admin (platform owner - no organization)
    const userRepository = dataSource.getRepository(UserEntity);
    const existingSuperAdmin = await userRepository.findOne({
      where: { email: 'superadmin@pos.com' },
    });

    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash('super123', 10);

      const superAdmin = userRepository.create({
        email: 'superadmin@pos.com',
        name: 'Super Admin',
        password: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      await userRepository.save(superAdmin);
      logger.log('✅ Super Admin created');
    } else {
      logger.log('Super Admin already exists, skipping...');
    }

    // Seed Organizations
    const organizationRepository = dataSource.getRepository(OrganizationEntity);
    const subscriptionRepository = dataSource.getRepository(SubscriptionEntity);

    let org1: any, org2: any;
    const existingOrg = await organizationRepository.findOne({
      where: { slug: 'demo-store' },
    });

    if (!existingOrg) {
      org1 = organizationRepository.create({
        name: 'Demo Store',
        slug: 'demo-store',
        email: 'contact@demo-store.com',
        description: 'Demo convenience store for testing',
        address: '123 Main Street',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        postalCode: '10001',
        phone: '+1-555-0100',
        settings: {
          currency: 'USD',
          timezone: 'America/New_York',
          language: 'en',
          taxRate: 0.08,
          features: {
            inventory: true,
            multipleTerminals: true,
            reporting: true,
            api: false,
          },
        },
      });

      org2 = organizationRepository.create({
        name: 'Coffee Shop',
        slug: 'coffee-shop',
        email: 'hello@coffee-shop.com',
        description: 'Local coffee shop',
        address: '456 Oak Avenue',
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        postalCode: '90001',
        phone: '+1-555-0200',
        settings: {
          currency: 'USD',
          timezone: 'America/Los_Angeles',
          language: 'en',
          taxRate: 0.095,
          features: {
            inventory: true,
            multipleTerminals: false,
            reporting: true,
            api: false,
          },
        },
      });

      await organizationRepository.save([org1, org2]);
      logger.log('✅ Organizations created');

      // Create subscriptions for organizations
      const subscription1 = subscriptionRepository.create({
        organizationId: org1.id,
        plan: SubscriptionPlan.PROFESSIONAL,
        status: SubscriptionStatus.ACTIVE,
        monthlyPrice: 99.0,
        billingCycle: 'monthly',
        limits: {
          maxUsers: 20,
          maxTerminals: 10,
          maxProducts: 10000,
          maxTransactionsPerMonth: 50000,
          features: {
            multipleLocations: true,
            advancedReporting: true,
            apiAccess: true,
            prioritySupport: false,
          },
        },
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const subscription2 = subscriptionRepository.create({
        organizationId: org2.id,
        plan: SubscriptionPlan.BASIC,
        status: SubscriptionStatus.TRIAL,
        monthlyPrice: 29.0,
        billingCycle: 'monthly',
        limits: {
          maxUsers: 5,
          maxTerminals: 2,
          maxProducts: 1000,
          maxTransactionsPerMonth: 5000,
          features: {
            multipleLocations: false,
            advancedReporting: true,
            apiAccess: false,
            prioritySupport: false,
          },
        },
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      await subscriptionRepository.save([subscription1, subscription2]);
      logger.log('✅ Subscriptions created');
    } else {
      org1 = existingOrg;
      org2 = await organizationRepository.findOne({
        where: { slug: 'coffee-shop' },
      });
      logger.log('Organizations already exist, skipping...');
    }

    // Seed Users with organization relationships
    const existingAdmin = await userRepository.findOne({
      where: { email: 'admin@demo-store.com' },
    });

    if (!existingAdmin && org1 && org2) {
      const hashedPassword = await bcrypt.hash('admin123', 10);

      // Demo Store users
      const admin1 = userRepository.create({
        email: 'admin@demo-store.com',
        name: 'John Admin',
        password: hashedPassword,
        role: UserRole.ADMIN,
        organizationId: org1.id,
        phone: '+1-555-0101',
        isActive: true,
      });

      const manager1 = userRepository.create({
        email: 'manager@demo-store.com',
        name: 'Jane Manager',
        password: await bcrypt.hash('manager123', 10),
        role: UserRole.MANAGER,
        organizationId: org1.id,
        phone: '+1-555-0102',
        isActive: true,
      });

      const cashier1 = userRepository.create({
        email: 'cashier@demo-store.com',
        name: 'Bob Cashier',
        password: await bcrypt.hash('cashier123', 10),
        role: UserRole.CASHIER,
        organizationId: org1.id,
        phone: '+1-555-0103',
        isActive: true,
      });

      // Coffee Shop users
      const admin2 = userRepository.create({
        email: 'admin@coffee-shop.com',
        name: 'Sarah Owner',
        password: hashedPassword,
        role: UserRole.ADMIN,
        organizationId: org2.id,
        phone: '+1-555-0201',
        isActive: true,
      });

      const cashier2 = userRepository.create({
        email: 'cashier@coffee-shop.com',
        name: 'Mike Barista',
        password: await bcrypt.hash('cashier123', 10),
        role: UserRole.CASHIER,
        organizationId: org2.id,
        phone: '+1-555-0202',
        isActive: true,
      });

      await userRepository.save([admin1, manager1, cashier1, admin2, cashier2]);
      logger.log('✅ Users created');
    } else {
      logger.log('Users already exist, skipping...');
    }

    // Seed Terminals
    const terminalRepository = dataSource.getRepository(TerminalEntity);
    const existingTerminal = await terminalRepository.findOne({
      where: { terminalId: 'TERMINAL-001' },
    });

    if (!existingTerminal && org1 && org2) {
      const terminal1 = terminalRepository.create({
        terminalId: 'TERMINAL-001',
        name: 'Front Counter',
        location: 'Main Entrance',
        organizationId: org1.id,
        isActive: true,
      });

      const terminal2 = terminalRepository.create({
        terminalId: 'TERMINAL-002',
        name: 'Self-Checkout',
        location: 'Side Entrance',
        organizationId: org1.id,
        isActive: true,
      });

      const terminal3 = terminalRepository.create({
        terminalId: 'TERMINAL-003',
        name: 'Coffee Bar',
        location: 'Main Counter',
        organizationId: org2.id,
        isActive: true,
      });

      await terminalRepository.save([terminal1, terminal2, terminal3]);
      logger.log('✅ Terminals created');
    } else {
      logger.log('Terminals already exist, skipping...');
    }

    // Seed Products
    const productRepository = dataSource.getRepository(ProductEntity);
    const existingProducts = await productRepository.count();

    // Clear old products if they exist (for reseeding)
    if (existingProducts > 0) {
      logger.log('Clearing old products...');
      await productRepository.clear();
    }

    if (org1) {
      const products = [
        {
          sku: 'BEV-001',
          name: 'Coca-Cola 500ml',
          description: 'Refreshing cola drink',
          category: 'Beverages',
          price: 2.49,
          cost: 1.2,
          taxRate: 0.08,
          stockQuantity: 150,
          lowStockThreshold: 30,
          barcode: '049000042566',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
        {
          sku: 'SNK-001',
          name: "Lay's Classic Chips",
          description: 'Original potato chips 150g',
          category: 'Snacks',
          price: 3.99,
          cost: 2.0,
          taxRate: 0.08,
          stockQuantity: 200,
          lowStockThreshold: 50,
          barcode: '028400047647',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
        {
          sku: 'FOOD-001',
          name: 'Cup Noodles Beef',
          description: 'Instant ramen cup',
          category: 'Food',
          price: 1.99,
          cost: 0.8,
          taxRate: 0.08,
          stockQuantity: 300,
          lowStockThreshold: 60,
          barcode: '070662045206',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
        {
          sku: 'DAIRY-001',
          name: 'Milk 1L',
          description: 'Fresh whole milk',
          category: 'Dairy',
          price: 4.49,
          cost: 2.5,
          taxRate: 0.0,
          stockQuantity: 80,
          lowStockThreshold: 20,
          barcode: '041130007224',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
        {
          sku: 'CANDY-001',
          name: 'Snickers Bar',
          description: 'Chocolate candy bar',
          category: 'Candy',
          price: 1.49,
          cost: 0.6,
          taxRate: 0.08,
          stockQuantity: 250,
          lowStockThreshold: 50,
          barcode: '040000519607',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
        {
          sku: 'BEV-002',
          name: 'Red Bull Energy Drink',
          description: '250ml energy drink',
          category: 'Beverages',
          price: 3.49,
          cost: 1.8,
          taxRate: 0.08,
          stockQuantity: 120,
          lowStockThreshold: 25,
          barcode: '611269991116',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
        {
          sku: 'SNK-002',
          name: 'Pringles Original',
          description: 'Stackable potato chips',
          category: 'Snacks',
          price: 2.99,
          cost: 1.5,
          taxRate: 0.08,
          stockQuantity: 180,
          lowStockThreshold: 40,
          barcode: '038000845505',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
        {
          sku: 'BREAD-001',
          name: 'White Bread Loaf',
          description: 'Fresh sliced bread',
          category: 'Bakery',
          price: 2.99,
          cost: 1.2,
          taxRate: 0.0,
          stockQuantity: 50,
          lowStockThreshold: 10,
          barcode: '007287505013',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
        {
          sku: 'COFFEE-001',
          name: 'Coffee To-Go Large',
          description: 'Fresh brewed coffee 16oz',
          category: 'Hot Beverages',
          price: 2.49,
          cost: 0.5,
          taxRate: 0.08,
          stockQuantity: 500,
          lowStockThreshold: 100,
          barcode: '123456789012',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
        {
          sku: 'ICE-001',
          name: 'Ice Cream Sandwich',
          description: 'Vanilla ice cream sandwich',
          category: 'Frozen',
          price: 1.99,
          cost: 0.8,
          taxRate: 0.08,
          stockQuantity: 100,
          lowStockThreshold: 20,
          barcode: '041130404023',
          status: ProductStatus.ACTIVE,
          organizationId: org1.id,
        },
      ];

      await productRepository.save(products);
      logger.log('✅ Products created');
    } else {
      logger.log('Products already exist, skipping...');
    }

    logger.log('🎉 Database seed completed successfully!');
    logger.log('\n📝 Default Credentials:');
    logger.log('  Super Admin: superadmin@pos.com / super123');
    logger.log('\n  Demo Store:');
    logger.log('    Admin: admin@demo-store.com / admin123');
    logger.log('    Manager: manager@demo-store.com / manager123');
    logger.log('    Cashier: cashier@demo-store.com / cashier123');
    logger.log('\n  Coffee Shop:');
    logger.log('    Admin: admin@coffee-shop.com / admin123');
    logger.log('    Cashier: cashier@coffee-shop.com / cashier123');
  } catch (error) {
    logger.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seed();
