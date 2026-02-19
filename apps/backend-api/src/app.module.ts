import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SyncModule } from './sync/sync.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { TerminalsModule } from './modules/terminals/terminals.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InventoryDeliveriesModule } from './modules/inventory-deliveries/inventory-deliveries.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { FinancialsModule } from './modules/financials/financials.module';
import { UploadModule } from './modules/upload/upload.module';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get('database');
        if (!config) {
          throw new Error('Database configuration not found');
        }
        return config;
      },
    }),
    AuthModule,
    SyncModule,
    OrganizationsModule,
    UsersModule,
    ProductsModule,
    TerminalsModule,
    OrdersModule,
    PaymentsModule,
    InventoryDeliveriesModule,
    ExpensesModule,
    FinancialsModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
