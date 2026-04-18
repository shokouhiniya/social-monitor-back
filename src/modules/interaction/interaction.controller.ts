import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InteractionService } from './interaction.service';

@Controller('interactions')
export class InteractionController {
  constructor(private readonly interactionService: InteractionService) {}

  @Get('page/:pageId')
  findByPage(@Param('pageId') pageId: number) {
    return this.interactionService.findByPage(pageId);
  }

  @Post()
  create(@Body() dto: any) {
    return this.interactionService.create(dto);
  }
}
