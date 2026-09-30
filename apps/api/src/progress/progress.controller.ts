import { Body, Controller, Delete, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/auth.guard';
import { CaseDto, ExamDto, QuizDto } from './progress.dto';
import { ProgressService } from './progress.service';

@Controller('progress')
@UseGuards(SessionGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}
  @Get() get(@Req() req: Request) { return this.progress.get(req.user!.id); }
  @Post('quiz') @HttpCode(200)
  quiz(@Req() req: Request, @Body() body: QuizDto) { return this.progress.quiz(req.user!.id, body.lessonKey, body.score, body.eventId); }
  @Post('exam') @HttpCode(200)
  exam(@Req() req: Request, @Body() body: ExamDto) { return this.progress.exam(req.user!.id, body.score, body.eventId); }
  @Post('case') @HttpCode(200)
  case(@Req() req: Request, @Body() body: CaseDto) { return this.progress.case(req.user!.id, body.slug, body.correct, body.eventId); }
  @Delete() reset(@Req() req: Request) { return this.progress.reset(req.user!.id); }
}
