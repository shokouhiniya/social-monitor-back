import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { CreateInteractionDto, InteractionListQuery } from './interactions.dto';

/**
 * کنترلر تعاملات (OperationsModule — design §5.10 / §7.2).
 *
 * زیر فضای نام `/operations/interactions` ثبت می‌شود تا با مسیر legacy
 * `/interactions` تداخل نکند (Requirement 1.6). Interaction گذار وضعیت ندارد؛
 * تنها `list`/`create` ارائه می‌شود.
 *
 * مسیرها:
 *  - GET  /operations/interactions — فهرست صفحه‌بندی‌شده (Requirement 9.5)
 *  - POST /operations/interactions — ساخت (Requirement 9.4)
 */
@Controller('operations/interactions')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  /** GET /operations/interactions — فهرست صفحه‌بندی‌شدهٔ تعاملات. */
  @Get()
  list(@Query() query: InteractionListQuery) {
    return this.interactionsService.list(query);
  }

  /** POST /operations/interactions — ساخت یک تعامل جدید. */
  @Post()
  create(@Body() dto: CreateInteractionDto) {
    return this.interactionsService.create(dto);
  }
}
