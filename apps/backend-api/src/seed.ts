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
        name: 'Main Counter',
        location: 'Store Front',
        isActive: true,
      });

      const terminal2 = terminalRepository.create({
        terminalId: 'TERMINAL-002',
        name: 'Express Checkout',
        location: 'Store Back',
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

    if (existingProducts === 0) {
      const products = [
        {
          sku: 'CPU-001',
          name: 'Intel Core i9-13900K',
          description: 'High-performance desktop processor',
          category: 'CPU',
          price: 589.99,
          cost: 450.00,
          taxRate: 0.12,
          stockQuantity: 50,
          lowStockThreshold: 10,
          barcode: '735858514736',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'GPU-001',
          name: 'NVIDIA RTX 4080',
          description: 'Premium graphics card',
          category: 'GPU',
          price: 1199.99,
          cost: 950.00,
          taxRate: 0.12,
          stockQuantity: 30,
          lowStockThreshold: 5,
          barcode: '812674028361',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'RAM-001',
          name: 'Corsair Vengeance 32GB DDR5',
          description: '32GB DDR5 RAM Kit',
          category: 'RAM',
          price: 149.99,
          cost: 110.00,
          taxRate: 0.12,
          stockQuantity: 100,
          lowStockThreshold: 20,
          barcode: '843591098731',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'SSD-001',
          name: 'Samsung 980 Pro 2TB',
          description: 'NVMe SSD 2TB',
          category: 'Storage',
          price: 199.99,
          cost: 150.00,
          taxRate: 0.12,
          stockQuantity: 75,
          lowStockThreshold: 15,
          barcode: '887276483542',
          status: ProductStatus.ACTIVE,
        },
        {
          sku: 'MB-001',
          name: 'ASUS ROG Strix Z790',
          description: 'Gaming motherboard',
          category: 'Motherboard',
          price: 399.99,
          cost: 300.00,
          taxRate: 0.12,
          stockQuantity: 40,
          lowStockThreshold: 8,
          barcode: '195553212458',
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
