import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { AdminStage } from '@jack-academy/contracts';

export class PaginationDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
export class AdminUsersDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  q = '';
  @IsIn(['all', 'not_started', 'started', 'completed', 'certified']) stage: AdminStage = 'all';
}
