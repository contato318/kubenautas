import { Controller, Get, Header, Param, ParseUUIDPipe } from '@nestjs/common';
import { CertificatesService } from './certificates.service';

@Controller('certificates')
export class PublicCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get(':id')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  verify(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.certificates.verify(id);
  }
}
