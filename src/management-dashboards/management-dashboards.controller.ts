import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ManagementDashboardsService } from './management-dashboards.service';

/**
 * کنترلر داشبوردهای مدیریتی (`/dashboards/*`) — design §4.
 * احراز هویت/scope از طریق گاردهای سراسری (AccessModule، flag-gated).
 */
@Controller('dashboards')
export class ManagementDashboardsController {
  constructor(private readonly service: ManagementDashboardsService) {}

  @Get('management')
  management() {
    return this.service.management();
  }

  @Get('hubs/:hubId')
  hub(@Param('hubId', ParseIntPipe) hubId: number) {
    return this.service.hub(hubId);
  }

  @Get('campaigns/:id')
  operation(@Param('id', ParseIntPipe) id: number) {
    return this.service.operation(id);
  }
}
