import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { StrategicAlertService } from './strategic-alert.service';
import { CreateStrategicAlertDto, UpdateAlertStatusDto } from './strategic-alert.dto';

@Controller('strategic-alerts')
export class StrategicAlertController {
  constructor(private readonly strategicAlertService: StrategicAlertService) {}

  @Get()
  findAll(@Query('status') status: string) {
    return this.strategicAlertService.findAll(status);
  }

  @Get('stats')
  getStats() {
    return this.strategicAlertService.getStats();
  }

  @Get('grouped')
  getGrouped() {
    return this.strategicAlertService.getGrouped();
  }

  @Get(':id')
  findById(@Param('id') id: number) {
    return this.strategicAlertService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateStrategicAlertDto) {
    return this.strategicAlertService.create(dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: number, @Body() dto: UpdateAlertStatusDto) {
    return this.strategicAlertService.updateStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.strategicAlertService.remove(id);
  }
}
