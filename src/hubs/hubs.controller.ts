import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { HubsService } from './hubs.service';
import { AssignHubUserDto, CreateHubDto, UpdateHubDto } from './hubs.dto';
import { Roles } from '../auth/roles.decorator';

/**
 * کنترلر هاب‌ها (`/hubs`) — design §4.
 * احراز هویت/نقش از طریق گاردهای سراسری (AccessModule، flag-gated) اعمال می‌شود؛
 * `@Roles` روی عملیات admin-only تنها هنگام `AUTH_ENFORCE=true` فعال است.
 */
@Controller('hubs')
export class HubsController {
  constructor(private readonly hubsService: HubsService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.hubsService.findAll(this.scope(req));
  }

  @Get('stats')
  listWithStats(@Req() req: Request) {
    return this.hubsService.listWithStats(this.scope(req));
  }

  /** استخراج scope هاب از request (که توسط HubScopeGuard الصاق شده). */
  private scope(req: Request) {
    return (req as unknown as Record<string, unknown>).hubScope as
      | { privileged: boolean; hubIds: number[] }
      | undefined;
  }

  @Get('assignable-users')
  assignableUsers() {
    return this.hubsService.listAssignableUsers();
  }

  @Roles('super_admin', 'admin')
  @Post()
  create(@Body() dto: CreateHubDto) {
    return this.hubsService.create(dto);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.hubsService.findById(id);
  }

  @Roles('super_admin', 'admin')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHubDto) {
    return this.hubsService.update(id, dto);
  }

  @Get(':id/users')
  listUsers(@Param('id', ParseIntPipe) id: number) {
    return this.hubsService.listUsers(id);
  }

  @Roles('super_admin', 'admin')
  @Post(':id/users')
  assignUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignHubUserDto,
  ) {
    return this.hubsService.assignUser(id, dto);
  }

  @Roles('super_admin', 'admin')
  @Delete(':id/users/:userId')
  removeUser(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.hubsService.removeUser(id, userId);
  }
}
