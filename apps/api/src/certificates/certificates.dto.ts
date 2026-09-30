import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class IssueCertificateDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : value)
  @IsString()
  @Length(3, 120)
  @Matches(/^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*[\p{L}\p{M}.]$/u, { message: 'Informe seu nome completo usando letras, espaços, pontos, apóstrofos ou hífens.' })
  fullName!: string;
}
