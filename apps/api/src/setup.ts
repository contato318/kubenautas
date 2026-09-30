import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { AppConfig } from './config';
import { DatabaseService } from './database/database.service';
import { OAuthService } from './auth/oauth.service';

export function setup(app: NestExpressApplication) {
  const config = app.get(AppConfig);
  const db = app.get(DatabaseService);
  const origin = new URL(config.frontendUrl).origin;
  app.setGlobalPrefix('api');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.enableCors({ origin, credentials: true, methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Protection', 'X-Account-Id'] });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (req.get('origin') !== origin || req.get('X-CSRF-Protection') !== '1')) {
      res.status(403).json({ message: 'Origem da requisição não permitida.' });
      return;
    }
    next();
  });
  app.useBodyParser('json', { limit: '16kb' });
  const PgStore = connectPgSimple(session);
  const store = new PgStore({ pool: db.pool, tableName: 'sessions', pruneSessionInterval: 15 * 60 });
  app.getHttpServer().on('close', () => store.close());
  app.use(session({
    name: config.cookieName, secret: config.sessionSecret,
    resave: false, saveUninitialized: false, store,
    cookie: { httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite as 'lax' | 'none', path: config.cookiePath, maxAge: 7 * 24 * 60 * 60_000 },
  }));
  app.use(app.get(OAuthService).passport.initialize());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  return store;
}
