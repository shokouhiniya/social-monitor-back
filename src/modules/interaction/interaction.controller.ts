import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InteractionService } from './interaction.service';

@Controller('interactions')
export class InteractionController {
  constructor(private readonly interactionService: InteractionService) {}

  @Get('page/:pageId')
  findByPage(@Param('pageId') pageId: number) {
    return this.interactionService.findByPage(pageId);
  }

  @Get('action-plan/:actionPlanId')
  findByActionPlan(@Param('actionPlanId') actionPlanId: number) {
    return this.interactionService.findByActionPlan(actionPlanId);
  }

  @Post()
  create(@Body() dto: any) {
    return this.interactionService.create(dto);
  }
}
