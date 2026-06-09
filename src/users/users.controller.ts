import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, SetPasswordDto, UpdateUserDto } from './users.dto';
import { Roles } from '../auth/roles.decorator';

/**
 * کنترلر مدیریت کاربران داخلی (`/users`) — پنل super_admin.
 *
 * احراز هویت/نقش از طریق گاردهای سراسری (AccessModule، flag-gated). `@Roles`
 * تنها هنگام `AUTH_ENFORCE=true` فعال می‌شود؛ مدیریت کاربران مخصوص
 * super_admin/admin است. مسیر `/users` به NEW_ROUTE_PREFIXES افزوده شده است.
 */
@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('super_admin', 'admin')
  @Get()
  list() {
    return this.usersService.listUsers();
  }

  @Roles('super_admin', 'admin')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createInternalUser({
      name: dto.name,
      username: dto.username,
      password: dto.password,
      role: dto.role,
      phone: dto.phone,
    });
  }

  @Roles('super_admin', 'admin')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Roles('super_admin', 'admin')
  @Patch(':id/password')
  setPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetPasswordDto,
  ) {
    return this.usersService.setPassword(id, dto.password);
  }
}
