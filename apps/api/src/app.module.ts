import { Controller, Get, Module } from '@nestjs/common';
import { AppConfig } from './config';
import { DatabaseService } from './database/database.service';
import { UsersService } from './auth/users.service';
import { OAuthService } from './auth/oauth.service';
import { AuthController } from './auth/auth.controller';
import { SessionGuard } from './auth/auth.guard';
import { ProgressController } from './progress/progress.controller';
import { ProgressService } from './progress/progress.service';
import { CertificatesController } from './certificates/certificates.controller';
import { CertificatesService } from './certificates/certificates.service';
import { PublicCertificatesController } from './certificates/public-certificates.controller';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AdminGuard } from './admin/admin.guard';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';

@Controller('health')
class HealthController {
  constructor(private readonly db: DatabaseService) {}
  @Get() async health() { await this.db.pool.query('SELECT 1'); return { status: 'ok' }; }
}

@Module({
  controllers: [HealthController, AuthController, ProgressController, CertificatesController, PublicCertificatesController, AdminController, ActivityController],
  providers: [AppConfig, DatabaseService, UsersService, OAuthService, SessionGuard, ProgressService, CertificatesService, AdminService, AdminGuard, ActivityService],
})
export class AppModule {}
