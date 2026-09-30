import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class QuizDto {
  @IsOptional() @IsUUID('4') eventId?: string;
  @IsString() @MaxLength(160) @Matches(/^[a-z0-9-]+\/[a-z0-9-]+$/)
  lessonKey!: string;
  @IsNumber({ allowInfinity: false, allowNaN: false }) @Min(0) @Max(1)
  score!: number;
}

export class ExamDto {
  @IsOptional() @IsUUID('4') eventId?: string;
  @IsNumber({ allowInfinity: false, allowNaN: false }) @Min(0) @Max(1)
  score!: number;
}

export class CaseDto {
  @IsOptional() @IsUUID('4') eventId?: string;
  @IsString() @MaxLength(120) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
  @IsBoolean()
  correct!: boolean;
}
