import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { safeReturnPath } from '@jack-academy/contracts';

@Injectable()
export class AppConfig {
  readonly production = process.env.NODE_ENV === 'production';
  readonly port = Number(process.env.PORT ?? 3000);
  readonly databaseUrl = this.required('DATABASE_URL');
  readonly sessionSecret = this.required('SESSION_SECRET');
  readonly frontendUrl = this.url('FRONTEND_URL', 'http://localhost:5173');
  readonly apiPublicUrl = this.url('API_PUBLIC_URL', 'http://localhost:5173/api');
  readonly trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  readonly cookieSecure = process.env.SESSION_COOKIE_SECURE ? process.env.SESSION_COOKIE_SECURE === 'true' : this.production;
  readonly cookieSameSite = process.env.SESSION_COOKIE_SAME_SITE ?? 'lax';
  // Keep the existing cookie name so the rebrand preserves active sessions.
  readonly cookieName = 'kubenautas.sid';
  readonly cookiePath = '/';
  readonly adminEmails = new Set((process.env.ADMIN_EMAILS ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean));

  constructor() {
    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) throw new Error('Invalid PORT');
    if (!Number.isInteger(this.trustProxy) || this.trustProxy < 0) throw new Error('Invalid TRUST_PROXY');
    if (this.sessionSecret.length < 32 || this.sessionSecret.startsWith('replace-')) throw new Error('Set SESSION_SECRET to a random value of at least 32 characters');
    if (!['lax', 'strict', 'none'].includes(this.cookieSameSite)) throw new Error('Invalid SESSION_COOKIE_SAME_SITE');
    if (this.cookieSameSite === 'strict') throw new Error('Use lax for OAuth redirects or none for cross-site deployments');
    if (this.cookieSameSite === 'none' && !this.cookieSecure) throw new Error('SameSite=None requires secure cookies');
    if (this.production && (!this.cookieSecure || !this.frontendUrl.startsWith('https:') || !this.apiPublicUrl.startsWith('https:'))) throw new Error('Production requires HTTPS URLs and secure cookies');
  }

  credentials(provider: 'google' | 'github') {
    const prefix = provider.toUpperCase();
    const id = process.env[`${prefix}_CLIENT_ID`];
    const secret = process.env[`${prefix}_CLIENT_SECRET`];
    return id && secret ? { id, secret } : null;
  }

  returnUrl(candidate: unknown) {
    return `${this.frontendUrl}${safeReturnPath(candidate)}`;
  }

  private required(key: string) {
    const value = process.env[key];
    if (!value) throw new Error(`Missing ${key}`);
    return value;
  }

  private url(key: string, fallback: string) {
    const value = new URL(process.env[key] ?? fallback);
    if (!['http:', 'https:'].includes(value.protocol) || value.username || value.password || value.search || value.hash) throw new Error(`Invalid ${key}`);
    return value.href.replace(/\/$/, '');
  }
}
