import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminUsersDto, PaginationDto } from './admin.dto';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('overview') overview() { return this.admin.overview(); }
  @Get('users') users(@Query() query: AdminUsersDto) { return this.admin.users(query); }
  @Get('users/:id') user(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.admin.user(id); }
  @Get('users/:id/activity') activity(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Query() query: PaginationDto) { return this.admin.activity(id, query); }
}
