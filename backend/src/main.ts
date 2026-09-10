import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map(o => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');

  const port = parseInt(process.env.PORT ?? '8080', 10);
  await app.listen(port);
  console.log(`NestJS server listening on port ${port}`);
}

bootstrap();
