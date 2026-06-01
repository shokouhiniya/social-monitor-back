import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';
import {
  ActionPlanListQuery,
  CreateActionPlanDto,
  TransitionActionPlanDto,
} from './action-plans.dto';

/**
 * کنترلر برنامه‌های عملیاتی (OperationsModule — design §5.10 / §7.2).
 *
 * زیر فضای نام `/operations/action-plans` ثبت می‌شود تا با مسیر legacy
 * `/action-plans` تداخل نکند (Requirement 1.6).
 *
 * مسیرها:
 *  - GET   /operations/action-plans                 — فهرست صفحه‌بندی‌شده (Requirement 9.5)
 *  - POST  /operations/action-plans                 — ساخت با وضعیت اولیهٔ معتبر (Requirement 9.4)
 *  - PATCH /operations/action-plans/:id/transition  — گذار وضعیت با اعتبارسنجی (Requirement 9.2, 9.3)
 */
@Controller('operations/action-plans')
export class ActionPlansController {
  constructor(private readonly actionPlansService: ActionPlansService) {}

  /** GET /operations/action-plans — فهرست صفحه‌بندی‌شدهٔ برنامه‌های عملیاتی. */
  @Get()
  list(@Query() query: ActionPlanListQuery) {
    return this.actionPlansService.list(query);
  }

  /** GET /operations/action-plans/:id — جزئیات یک برنامهٔ عملیاتی. */
  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.actionPlansService.findById(id);
  }

  /** POST /operations/action-plans — ساخت یک برنامهٔ عملیاتی جدید. */
  @Post()
  create(@Body() dto: CreateActionPlanDto) {
    return this.actionPlansService.create(dto);
  }

  /** PATCH /operations/action-plans/:id/transition — گذار وضعیت معتبر. */
  @Patch(':id/transition')
  transition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransitionActionPlanDto,
  ) {
    return this.actionPlansService.transition(id, dto);
  }
}
