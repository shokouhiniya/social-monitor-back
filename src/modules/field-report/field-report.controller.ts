import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FieldReportService } from './field-report.service';
import { CreateFieldReportDto, FieldReportQueryDto } from './field-report.dto';

@Controller('field-reports')
export class FieldReportController {
  constructor(private readonly fieldReportService: FieldReportService) {}

  @Get()
  findAll(@Query() query: FieldReportQueryDto) {
    return this.fieldReportService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id') id: number) {
    return this.fieldReportService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateFieldReportDto) {
    return this.fieldReportService.create(dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: number, @Body('status') status: string) {
    return this.fieldReportService.updateStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.fieldReportService.remove(id);
  }
}
