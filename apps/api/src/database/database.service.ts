import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfig } from '../config';
import { migrate } from './migrations';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly pool: Pool;
  constructor(config: AppConfig) {
    this.pool = new Pool({ connectionString: config.databaseUrl, max: 10, connectionTimeoutMillis: 5000 });
    this.pool.on('error', () => console.error('An idle database connection failed'));
  }
  async onModuleInit() { await migrate(this.pool); }
  async onModuleDestroy() { await this.pool.end(); }
}
