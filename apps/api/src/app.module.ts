import { Controller, Get, Module } from '@nestjs/common';
import { AppConfig } from './config';
import { DatabaseService } from './database/database.service';
import { UsersService } from './auth/users.service';
import { OAuthService } from './auth/oauth.service';
import { AuthController } from './auth/auth.controller';
import { SessionGuard } from './auth/auth.guard';
import { ProgressController } from './progress/progress.controller';
import { ProgressService } from './progress/progress.service';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';

@Controller('health')
class HealthController {
  constructor(private readonly db: DatabaseService) {}
  @Get() async health() { await this.db.pool.query('SELECT 1'); return { status: 'ok' }; }
}

@Module({
  controllers: [HealthController, AuthController, ProgressController, ActivityController],
  providers: [AppConfig, DatabaseService, UsersService, OAuthService, SessionGuard, ProgressService, ActivityService],
})
export class AppModule {}
