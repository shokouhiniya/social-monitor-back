import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { UserService } from '../user.service';
import { ServerService } from '../../hetzner/server.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { UpdatePermissionsDto } from '../dto/update-permissions.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUserController {
  constructor(
    private readonly userService: UserService,
    @Inject(forwardRef(() => ServerService))
    private readonly serverService: ServerService,
  ) {}

  @Get()
  async getAllUsers() {
    return await this.userService.getAllWithAssignmentCounts();
  }

  @Get(':id')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.getUserByIdWithPermissions(id);
  }

  @Put(':id/permissions')
  @HttpCode(HttpStatus.OK)
  async updatePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePermissionsDto: UpdatePermissionsDto,
  ) {
    const permissions = await this.userService.updatePermissions(
      id,
      updatePermissionsDto,
    );
    return {
      message: 'Permissions updated successfully',
      permissions,
    };
  }

  @Get(':id/servers')
  async getUserServers(@Param('id', ParseIntPipe) id: number) {
    return await this.serverService.getUserServers(id);
  }
}
