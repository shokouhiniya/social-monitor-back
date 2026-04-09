import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { StrategicAlertService } from './strategic-alert.service';
import { CreateStrategicAlertDto } from './strategic-alert.dto';

@Controller('strategic-alerts')
export class StrategicAlertController {
  constructor(private readonly strategicAlertService: StrategicAlertService) {}

  @Get()
  findAll() {
    return this.strategicAlertService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: number) {
    return this.strategicAlertService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateStrategicAlertDto) {
    return this.strategicAlertService.create(dto);
  }

  @Patch(':id/acknowledge')
  acknowledge(@Param('id') id: number) {
    return this.strategicAlertService.acknowledge(id);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.strategicAlertService.remove(id);
  }
}
