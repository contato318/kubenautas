import { Equals } from 'class-validator';

export class DeleteAccountDto {
  @Equals('EXCLUIR') confirmation!: string;
}
