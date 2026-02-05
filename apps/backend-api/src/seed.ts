import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { TerminalEntity } from './entities/terminal.entity';
import { ProductEntity } from './entities/product.entity';
import * as bcrypt from 'bcrypt';
import { UserRole, ProductStatus } from '@pos/shared-types';

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    logger.log('Starting database seed...');

    // Seed Users
    const userRepository = dataSource.getRepository(UserEntity);
    const existingAdmin = await userRepository.findOne({ where: { email: 'admin@pos.com' } });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const admin = userRepository.create({
        email: 'admin@pos.com',
        name: 'Admin User',
        password: hashedPassword,
        role: UserRole.ADMIN,
        isActive: true,
      });

      const cashier = userRepository.create({
        email: 'cashier@pos.com',
        name: 'Cashier User',
        password: await bcrypt.hash('cashier123', 10),
        role: UserRole.CASHIER,
        isActive: true,
      });

      await userRepository.save([admin, cashier]);
      logger.log('✅ Users created');
    } else {
      logger.log('Users already exist, skipping...');
    }

    // Seed Terminals
    const terminalRepository = dataSource.getRepository(TerminalEntity);
    const existingTerminal = await terminalRepository.findOne({ where: { terminalId: 'TERMINAL-001' } });

    if (!existingTerminal) {
      const terminal1 = terminalRepository.create({
        terminalId: 'TERMINAL-001',
        name: 'Front Counter',
        location: 'Main Entrance',
        isActive: true,
      });

      const terminal2 = terminalRepository.create({
        terminalId: 'TERMINAL-002',
        name: 'Self-Checkout',
        location: 'Side Entrance',
        isActive: true,
      });

      await terminalRepository.save([terminal1, terminal2]);
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

    if (true) {
      const products = [
        {
          sku: 'BEV-001',
          name: 'Coca-Cola 500ml',
          description: 'Refreshing cola drink',
          category: 'Beverages',
          price: 2.49,
          cost: 1.20,
          taxRate: 0.08,
          stockQuantity: 150,
          lowStockThreshold: 30,
          barcode: '049000042566',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'SNK-001',
          name: "Lay's Classic Chips",
          description: 'Original potato chips 150g',
          category: 'Snacks',
          price: 3.99,
          cost: 2.00,
          taxRate: 0.08,
          stockQuantity: 200,
          lowStockThreshold: 50,
          barcode: '028400047647',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'FOOD-001',
          name: 'Cup Noodles Beef',
          description: 'Instant ramen cup',
          category: 'Food',
          price: 1.99,
          cost: 0.80,
          taxRate: 0.08,
          stockQuantity: 300,
          lowStockThreshold: 60,
          barcode: '070662045206',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'DAIRY-001',
          name: 'Milk 1L',
          description: 'Fresh whole milk',
          category: 'Dairy',
          price: 4.49,
          cost: 2.50,
          taxRate: 0.00,
          stockQuantity: 80,
          lowStockThreshold: 20,
          barcode: '041130007224',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'CANDY-001',
          name: 'Snickers Bar',
          description: 'Chocolate candy bar',
          category: 'Candy',
          price: 1.49,
          cost: 0.60,
          taxRate: 0.08,
          stockQuantity: 250,
          lowStockThreshold: 50,
          barcode: '040000519607',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'BEV-002',
          name: 'Red Bull Energy Drink',
          description: '250ml energy drink',
          category: 'Beverages',
          price: 3.49,
          cost: 1.80,
          taxRate: 0.08,
          stockQuantity: 120,
          lowStockThreshold: 25,
          barcode: '611269991116',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'SNK-002',
          name: 'Pringles Original',
          description: 'Stackable potato chips',
          category: 'Snacks',
          price: 2.99,
          cost: 1.50,
          taxRate: 0.08,
          stockQuantity: 180,
          lowStockThreshold: 40,
          barcode: '038000845505',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'BREAD-001',
          name: 'White Bread Loaf',
          description: 'Fresh sliced bread',
          category: 'Bakery',
          price: 2.99,
          cost: 1.20,
          taxRate: 0.00,
          stockQuantity: 50,
          lowStockThreshold: 10,
          barcode: '007287505013',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'COFFEE-001',
          name: 'Coffee To-Go Large',
          description: 'Fresh brewed coffee 16oz',
          category: 'Hot Beverages',
          price: 2.49,
          cost: 0.50,
          taxRate: 0.08,
          stockQuantity: 500,
          lowStockThreshold: 100,
          barcode: '123456789012',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'ICE-001',
          name: 'Ice Cream Sandwich',
          description: 'Vanilla ice cream sandwich',
          category: 'Frozen',
          price: 1.99,
          cost: 0.80,
          taxRate: 0.08,
          stockQuantity: 100,
          lowStockThreshold: 20,
          barcode: '041130404023',
          status: ProductStatus.ACTIVE,
        },
      ];

      await productRepository.save(products);
      logger.log('✅ Products created');
    } else {
      logger.log('Products already exist, skipping...');
    }

    logger.log('🎉 Database seed completed successfully!');
    logger.log('\n📝 Default Credentials:');
    logger.log('  Admin: admin@pos.com / admin123');
    logger.log('  Cashier: cashier@pos.com / cashier123');
  } catch (error) {
    logger.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seed();
