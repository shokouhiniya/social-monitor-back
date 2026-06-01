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
import { AlertsService } from './strategic-alerts.service';
import {
  AlertListQuery,
  CreateAlertDto,
  TransitionAlertDto,
} from './strategic-alerts.dto';

/**
 * کنترلر هشدارهای راهبردی (OperationsModule — design §5.10 / §7.2).
 *
 * زیر فضای نام `/operations/alerts` ثبت می‌شود تا با مسیر legacy
 * `/strategic-alerts` (که در دورهٔ گذار حفظ می‌شود) تداخل نکند
 * (Requirement 1.6). بسته‌بندی Response Envelope و نگاشت خطا به‌صورت سراسری
 * انجام می‌شود (Requirement 12).
 *
 * مسیرها:
 *  - GET   /operations/alerts                 — فهرست صفحه‌بندی‌شده (Requirement 9.5)
 *  - POST  /operations/alerts                 — ساخت با وضعیت اولیهٔ معتبر (Requirement 9.4)
 *  - PATCH /operations/alerts/:id/transition  — گذار وضعیت با اعتبارسنجی (Requirement 9.1, 9.3)
 */
@Controller('operations/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  /** GET /operations/alerts — فهرست صفحه‌بندی‌شدهٔ هشدارها. */
  @Get()
  list(@Query() query: AlertListQuery) {
    return this.alertsService.list(query);
  }

  /** GET /operations/alerts/:id — جزئیات یک هشدار. */
  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.alertsService.findById(id);
  }

  /** POST /operations/alerts — ساخت یک هشدار جدید. */
  @Post()
  create(@Body() dto: CreateAlertDto) {
    return this.alertsService.create(dto);
  }

  /** PATCH /operations/alerts/:id/transition — گذار وضعیت معتبر. */
  @Patch(':id/transition')
  transition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransitionAlertDto,
  ) {
    return this.alertsService.transition(id, dto);
  }
}
