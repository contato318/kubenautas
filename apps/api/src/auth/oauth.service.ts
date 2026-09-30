import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Passport } from 'passport';
import { Strategy, type VerifyCallback } from 'passport-oauth2';
import { safeReturnPath, type AuthProvider } from '@jack-academy/contracts';
import { AppConfig } from '../config';
import { UsersService, type ProviderIdentity } from './users.service';

@Injectable()
export class OAuthService {
  readonly passport = new Passport();
  readonly providers: Record<AuthProvider, boolean>;

  constructor(private readonly config: AppConfig, private readonly users: UsersService) {
    this.providers = { google: !!config.credentials('google'), github: !!config.credentials('github') };
    for (const provider of ['google', 'github'] as const) {
      const credentials = config.credentials(provider);
      if (!credentials) continue;
      this.passport.use(provider, new Strategy({
        authorizationURL: provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://github.com/login/oauth/authorize',
        tokenURL: provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://github.com/login/oauth/access_token',
        clientID: credentials.id,
        clientSecret: credentials.secret,
        callbackURL: `${config.apiPublicUrl}/auth/${provider}/callback`,
        scope: provider === 'google' ? ['openid', 'profile', 'email'] : ['read:user', 'user:email'],
        state: true,
        pkce: true,
        customHeaders: { 'User-Agent': 'Jack Academy' },
      }, (accessToken: string, _refreshToken: string, _profile: unknown, done: VerifyCallback) => {
        this.profile(provider, accessToken)
          .then((identity) => this.users.upsert(identity))
          .then((user) => done(null, user), () => done(new Error('OAuth profile validation failed')));
      }));
    }
  }

  requireProvider(value: string): AuthProvider {
    if ((value !== 'google' && value !== 'github') || !this.providers[value]) throw new ServiceUnavailableException('Este provedor de login não está disponível.');
    return value;
  }

  failureUrl(returnTo?: string) {
    const query = new URLSearchParams({ error: 'oauth_failed' });
    const destination = safeReturnPath(returnTo);
    if (destination !== '/trilha') query.set('returnTo', destination);
    return `${this.config.frontendUrl}/entrar?${query}`;
  }

  async profile(provider: AuthProvider, accessToken: string): Promise<ProviderIdentity> {
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'Jack Academy' };
    const get = async (url: string) => {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000), redirect: 'error' });
      if (!response.ok) throw new Error('Provider request failed');
      return response.json();
    };
    const data = await get(provider === 'google' ? 'https://openidconnect.googleapis.com/v1/userinfo' : 'https://api.github.com/user');
    const subject = provider === 'google' ? data.sub : data.id;
    if ((typeof subject !== 'string' && typeof subject !== 'number') || !String(subject)) throw new Error('Missing provider identity');
    let email: string | null = null;
    if (provider === 'google') {
      if (data.email_verified === true && typeof data.email === 'string') email = data.email;
    } else {
      const emails = await get('https://api.github.com/user/emails');
      if (!Array.isArray(emails)) throw new Error('Invalid email response');
      const verified = emails.find((item) => item.primary && item.verified && typeof item.email === 'string');
      email = verified?.email ?? null;
    }
    const name = typeof data.name === 'string' && data.name.trim() ? data.name : (provider === 'github' && typeof data.login === 'string' ? data.login : 'Estudante');
    const avatar = provider === 'google' ? data.picture : data.avatar_url;
    return { provider, subject: String(subject), name: name.slice(0, 200), email, avatarUrl: typeof avatar === 'string' && avatar.startsWith('https://') ? avatar : null };
  }
}
