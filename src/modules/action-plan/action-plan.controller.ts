import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ActionPlanService } from './action-plan.service';
import { CreateActionPlanDto, CreateActionPlanFromAlertDto, UpdateActionPlanDto } from './action-plan.dto';

@Controller('action-plans')
export class ActionPlanController {
  constructor(private readonly actionPlanService: ActionPlanService) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('assigned_to') assigned_to?: string) {
    return this.actionPlanService.findAll({ status, assigned_to });
  }

  @Get('stats')
  getStats() {
    return this.actionPlanService.getStats();
  }

  @Get('page/:pageId')
  findByPage(@Param('pageId') pageId: number) {
    return this.actionPlanService.findByPage(pageId);
  }

  @Get('cluster/:clusterId')
  findByCluster(@Param('clusterId') clusterId: number) {
    return this.actionPlanService.findByCluster(clusterId);
  }

  @Get('alert/:alertId')
  findByAlert(@Param('alertId') alertId: number) {
    return this.actionPlanService.findByAlert(alertId);
  }

  @Get(':id')
  findById(@Param('id') id: number) {
    return this.actionPlanService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateActionPlanDto) {
    return this.actionPlanService.create(dto);
  }

  @Post('from-alert')
  createFromAlert(@Body() dto: CreateActionPlanFromAlertDto) {
    return this.actionPlanService.createFromAlert(dto);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateActionPlanDto) {
    return this.actionPlanService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.actionPlanService.remove(id);
  }
}
