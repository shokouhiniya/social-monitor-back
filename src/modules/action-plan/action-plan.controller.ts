import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ActionPlanService } from './action-plan.service';
import { CreateActionPlanDto, UpdateActionPlanDto } from './action-plan.dto';

@Controller('action-plans')
export class ActionPlanController {
  constructor(private readonly actionPlanService: ActionPlanService) {}

  @Get('page/:pageId')
  findByPage(@Param('pageId') pageId: number) {
    return this.actionPlanService.findByPage(pageId);
  }

  @Get(':id')
  findById(@Param('id') id: number) {
    return this.actionPlanService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateActionPlanDto) {
    return this.actionPlanService.create(dto);
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
