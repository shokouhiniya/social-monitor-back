import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { InteractionsV2Service } from './interactions-v2.service';
import {
  CreateInteractionV2Dto,
  InteractionV2ListQuery,
} from './interactions-v2.dto';

/**
 * کنترلر تعاملات جدید (`/interactions-v2`) — design §4.
 * احراز هویت/scope از طریق گاردهای سراسری (AccessModule، flag-gated).
 */
@Controller('interactions-v2')
export class InteractionsV2Controller {
  constructor(private readonly interactions: InteractionsV2Service) {}

  @Get()
  list(@Query() query: InteractionV2ListQuery, @Req() req: Request) {
    const scope = (req as unknown as Record<string, unknown>).hubScope as
      | { privileged: boolean; hubIds: number[] }
      | undefined;
    return this.interactions.list(query, scope);
  }

  @Get('overview')
  overview() {
    return this.interactions.overview();
  }

  @Post()
  create(@Body() dto: CreateInteractionV2Dto) {
    return this.interactions.create(dto);
  }
}
