import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { safeReturnPath, type SessionResponse } from '@jack-academy/contracts';
import { AppConfig } from '../config';
import { OAuthService } from './oauth.service';
import { UsersService } from './users.service';
import { SessionGuard } from './auth.guard';
import { DeleteAccountDto } from './delete-account.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly oauth: OAuthService, private readonly users: UsersService, private readonly config: AppConfig) {}

  @Get('me')
  async me(@Req() request: Request): Promise<SessionResponse> {
    const user = request.session.userId ? await this.users.find(request.session.userId) : null;
    return { user, providers: this.oauth.providers };
  }

  @Post('welcome')
  @UseGuards(SessionGuard)
  @HttpCode(200)
  completeWelcome(@Req() request: Request) {
    return this.users.completeWelcome(request.user!.id);
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  @HttpCode(204)
  async logout(@Req() request: Request, @Res() response: Response) {
    await new Promise<void>((resolve, reject) => request.session.destroy((error) => error ? reject(error) : resolve()));
    response.clearCookie(this.config.cookieName, { path: this.config.cookiePath, httpOnly: true, secure: this.config.cookieSecure, sameSite: this.config.cookieSameSite as 'lax' | 'none' });
    response.status(204).end();
  }

  @Delete('account')
  @UseGuards(SessionGuard)
  @HttpCode(204)
  async deleteAccount(@Req() request: Request, @Res() response: Response, @Body() _body: DeleteAccountDto) {
    await this.users.deleteAccount(request.user!.id);
    await new Promise<void>((resolve, reject) => request.session.destroy((error) => error ? reject(error) : resolve()));
    response.clearCookie(this.config.cookieName, { path: this.config.cookiePath, httpOnly: true, secure: this.config.cookieSecure, sameSite: this.config.cookieSameSite as 'lax' | 'none' });
    response.status(204).end();
  }

  @Get(':provider/callback')
  callback(@Param('provider') value: string, @Req() request: Request, @Res() response: Response) {
    const provider = this.oauth.requireProvider(value);
    const returnTo = this.config.returnUrl(request.session.returnTo);
    const failureUrl = this.oauth.failureUrl(request.session.returnTo);
    if (request.session.oauthProvider !== provider || !request.session.oauthStartedAt || Date.now() - request.session.oauthStartedAt > 10 * 60_000) {
      response.redirect(failureUrl);
      return;
    }
    const finish = async (error: unknown, user?: Express.User | false | null) => {
      delete request.session.oauthStartedAt;
      delete request.session.oauthProvider;
      delete request.session.returnTo;
      if (error || !user) {
        await new Promise<void>((resolve) => request.session.save(() => resolve()));
        response.redirect(failureUrl);
        return;
      }
      // Rotate the session identifier after authentication; store no provider tokens.
      await new Promise<void>((resolve, reject) => request.session.regenerate((err) => err ? reject(err) : resolve()));
      request.session.userId = user.id;
      await new Promise<void>((resolve, reject) => request.session.save((err) => err ? reject(err) : resolve()));
      response.redirect(returnTo);
    };
    this.oauth.passport.authenticate(provider, { session: false }, (error: unknown, user?: Express.User | false | null) => {
      void finish(error, user).catch(() => { if (!response.headersSent) response.redirect(failureUrl); });
    })(request, response, () => response.redirect(failureUrl));
  }

  @Get(':provider')
  start(@Param('provider') value: string, @Req() request: Request, @Res() response: Response) {
    const provider = this.oauth.requireProvider(value);
    request.session.returnTo = safeReturnPath(request.query.returnTo);
    request.session.oauthStartedAt = Date.now();
    request.session.oauthProvider = provider;
    this.oauth.passport.authenticate(provider, { session: false })(request, response, () => response.redirect(this.oauth.failureUrl(request.session.returnTo)));
  }
}
