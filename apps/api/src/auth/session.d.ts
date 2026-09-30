import type { User } from '@jack-academy/contracts';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    returnTo?: string;
    oauthStartedAt?: number;
    oauthProvider?: 'google' | 'github';
  }
}

declare global {
  namespace Express {
    interface User extends importUser {}
  }
}
type importUser = User;
