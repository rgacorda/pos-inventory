import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@pos/shared-types';

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    logger.log('Starting database seed...');

    // Seed Super Admin (platform owner - no organization)
    const userRepository = dataSource.getRepository(UserEntity);
    const existingSuperAdmin = await userRepository.findOne({
      where: { email: 'rgacorda02@gmail.com' },
    });

    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash('superronjay123', 10);

      const superAdmin = userRepository.create({
        email: 'rgacorda02@gmail.com',
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

    logger.log('🎉 Database seed completed successfully!');
    logger.log('\n📝 Default Credentials:');
    logger.log('  Super Admin: rgacorda02@gmail.com / superronjay123');
  } catch (error) {
    logger.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seed();
