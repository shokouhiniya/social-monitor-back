import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FieldReportsService } from './field-reports.service';
import { CreateFieldReportDto, FieldReportListQuery } from './field-reports.dto';

/**
 * کنترلر گزارش‌های میدانی (OperationsModule — design §5.10 / §7.2).
 *
 * زیر فضای نام `/operations/field-reports` ثبت می‌شود تا با مسیر legacy
 * `/field-reports` تداخل نکند (Requirement 1.6). FieldReport گذار وضعیتِ
 * گذارمحور ندارد؛ تنها `list`/`create` ارائه می‌شود.
 *
 * مسیرها:
 *  - GET  /operations/field-reports — فهرست صفحه‌بندی‌شده (Requirement 9.5)
 *  - POST /operations/field-reports — ساخت با وضعیت اولیهٔ معتبر (Requirement 9.4)
 */
@Controller('operations/field-reports')
export class FieldReportsController {
  constructor(private readonly fieldReportsService: FieldReportsService) {}

  /** GET /operations/field-reports — فهرست صفحه‌بندی‌شدهٔ گزارش‌های میدانی. */
  @Get()
  list(@Query() query: FieldReportListQuery) {
    return this.fieldReportsService.list(query);
  }

  /** POST /operations/field-reports — ساخت یک گزارش میدانی جدید. */
  @Post()
  create(@Body() dto: CreateFieldReportDto) {
    return this.fieldReportsService.create(dto);
  }
}
