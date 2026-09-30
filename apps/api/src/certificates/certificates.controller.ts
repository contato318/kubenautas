import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/auth.guard';
import { IssueCertificateDto } from './certificates.dto';
import { CertificatesService } from './certificates.service';

@Controller('certificate')
@UseGuards(SessionGuard)
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}
  @Get() async get(@Req() req: Request) { return { certificate: await this.certificates.get(req.user!.id) }; }
  @Post() @HttpCode(200)
  issue(@Req() req: Request, @Body() body: IssueCertificateDto) { return this.certificates.issue(req.user!.id, body.fullName); }
}
