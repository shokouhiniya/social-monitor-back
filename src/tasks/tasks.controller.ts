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
import { TasksService } from './tasks.service';
import {
  ChangeTaskStatusDto,
  CreateTaskDto,
  TaskListQueryDto,
  UpdateTaskDto,
} from './tasks.dto';

/** کنترلر تسک‌ها (`/tasks`) — design §4. گاردهای سراسری flag-gated. */
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@Query() query: TaskListQueryDto, @Req() req: Request) {
    const scope = (req as unknown as Record<string, unknown>).hubScope as
      | { privileged: boolean; hubIds: number[] }
      | undefined;
    return this.tasksService.list(query, scope);
  }

  @Get('overview')
  overview(@Req() req: Request) {
    const scope = (req as unknown as Record<string, unknown>).hubScope as
      | { privileged: boolean; hubIds: number[] }
      | undefined;
    return this.tasksService.overview(scope);
  }

  @Post()
  create(@Body() dto: CreateTaskDto, @Req() req: Request) {
    const user = (req as unknown as Record<string, unknown>).user as
      | { id: number }
      | undefined;
    return this.tasksService.create({
      ...dto,
      created_by_user_id: dto.created_by_user_id ?? user?.id,
    });
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    const task = await this.tasksService.findById(id);
    const tags = await this.tasksService.getTags(id);
    return { ...task, tags };
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeTaskStatusDto,
  ) {
    return this.tasksService.changeStatus(id, dto);
  }

  @Post(':id/tags')
  setTags(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { tags: string[] },
  ) {
    return this.tasksService.setTags(id, body.tags ?? []);
  }
}
