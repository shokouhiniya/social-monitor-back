import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CampaignsService } from './campaigns.service';
import {
  AddMediaToOperationDto,
  CreateOperationDto,
  CreateOperationOutputDto,
  CreateOperationTaskDto,
  OperationListQueryDto,
  UpdateOperationDto,
} from './campaigns.dto';

/**
 * کنترلر عملیات/کمپین (`/campaigns`) — design §4، تصمیم ۴.
 * مسیر `/campaigns` برای تداخل صفر با کنترلرهای legacy `/operations/*` است؛ در UI
 * «عملیات». احراز هویت/scope از طریق گاردهای سراسری (AccessModule، flag-gated).
 */
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@Query() query: OperationListQueryDto, @Req() req: Request) {
    const scope = (req as unknown as Record<string, unknown>).hubScope as
      | { privileged: boolean; hubIds: number[]; userId: number | null }
      | undefined;
    return this.campaigns.list(query, scope);
  }

  @Post()
  create(@Body() dto: CreateOperationDto, @Req() req: Request) {
    const user = (req as unknown as Record<string, unknown>).user as
      | { id: number }
      | undefined;
    return this.campaigns.create({
      ...dto,
      owner_user_id: dto.owner_user_id ?? user?.id,
    });
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.getDetail(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperationDto,
  ) {
    return this.campaigns.update(id, dto);
  }

  @Get(':id/media')
  listMedia(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.listMedia(id);
  }

  @Post(':id/media')
  addMedia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMediaToOperationDto,
  ) {
    return this.campaigns.addMedia(id, dto);
  }

  @Get(':id/tasks')
  listTasks(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.listTasks(id);
  }

  @Post(':id/tasks')
  createTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOperationTaskDto,
  ) {
    return this.campaigns.createTask(id, dto);
  }

  @Get(':id/outputs')
  listOutputs(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.listOutputs(id);
  }

  @Post(':id/outputs')
  addOutput(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOperationOutputDto,
  ) {
    return this.campaigns.addOutput(id, dto);
  }

  @Get(':id/impact')
  impact(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.impactReport(id);
  }
}
