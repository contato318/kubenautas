import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (!context.switchToHttp().getRequest<Request>().user?.isAdmin) throw new ForbiddenException('Acesso restrito a administradores.');
    return true;
  }
}
