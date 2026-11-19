import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { applyTenantUniqueness } from './common/tenant-uniqueness';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await applyTenantUniqueness(app.get(DataSource));

  // Enable CORS for frontend apps
  app.enableCors();

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend API running on http://0.0.0.0:${port}`);
}
bootstrap();
