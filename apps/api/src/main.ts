import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfig } from './config';
import { setup } from './setup';

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  setup(app);
  app.enableShutdownHooks();
  await app.listen(app.get(AppConfig).port, '0.0.0.0');
}
void main().catch(() => { console.error('API startup failed. Check configuration and database availability.'); process.exitCode = 1; });
