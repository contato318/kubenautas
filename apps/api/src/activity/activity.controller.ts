import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Request } from 'express';
import type { VisitKind } from '@jack-academy/contracts';
import { SessionGuard } from '../auth/auth.guard';
import { ActivityService } from './activity.service';

class VisitDto {
  @IsIn(['lesson_opened', 'simulator_opened', 'case_opened', 'exam_started']) kind!: VisitKind;
  @IsString() @MaxLength(160) target!: string;
  @IsUUID('4') eventId!: string;
}

@Controller('activity')
@UseGuards(SessionGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}
  @Post() @HttpCode(204)
  visit(@Req() req: Request, @Body() body: VisitDto) { return this.activity.visit(req.user!.id, body); }
}
