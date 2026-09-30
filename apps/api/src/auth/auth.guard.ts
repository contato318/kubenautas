import { CanActivate, ConflictException, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.session.userId ? await this.users.find(request.session.userId) : null;
    if (!user) throw new UnauthorizedException('Entre para salvar seu progresso.');
    if (request.get('X-Account-Id') !== user.id) throw new ConflictException('A conta mudou. Recarregue seu progresso.');
    request.user = user;
    return true;
  }
}
