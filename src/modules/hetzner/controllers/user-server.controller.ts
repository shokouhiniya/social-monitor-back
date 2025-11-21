import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ServerService } from '../server.service';
import { HetznerService } from '../hetzner.service';
import { UserService } from '../../user/user.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class UserServerController {
  constructor(
    private readonly serverService: ServerService,
    private readonly hetznerService: HetznerService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  @Get()
  async getUserServers(@CurrentUser() user: any) {
    return await this.serverService.getUserServers(user.id);
  }

  @Get(':id')
  async getServer(@Param('id') serverId: string, @CurrentUser() user: any) {
    const hasAccess = await this.serverService.hasServerAccess(
      user.id,
      serverId,
    );

    if (!hasAccess) {
      throw new HttpException(
        'Access denied to this server',
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if user has permission to view server details
    const canViewDetails = await this.userService.hasPermission(
      user.id,
      'canViewDetails',
    );

    if (!canViewDetails) {
      throw new HttpException(
        'You do not have permission to view server details',
        HttpStatus.FORBIDDEN,
      );
    }

    return await this.hetznerService.getServer(serverId);
  }

  @Post(':id/power-on')
  @HttpCode(HttpStatus.OK)
  async powerOn(@Param('id') serverId: string, @CurrentUser() user: any) {
    const hasAccess = await this.serverService.hasServerAccess(
      user.id,
      serverId,
    );

    if (!hasAccess) {
      throw new HttpException(
        'Access denied to this server',
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if user has permission to manage power
    const canManagePower = await this.userService.hasPermission(
      user.id,
      'canManagePower',
    );

    if (!canManagePower) {
      throw new HttpException(
        'You do not have permission to manage server power',
        HttpStatus.FORBIDDEN,
      );
    }

    const result = await this.hetznerService.powerOnServer(serverId);
    return {
      message: 'Server power on initiated',
      action: result.action,
    };
  }

  @Post(':id/power-off')
  @HttpCode(HttpStatus.OK)
  async powerOff(@Param('id') serverId: string, @CurrentUser() user: any) {
    const hasAccess = await this.serverService.hasServerAccess(
      user.id,
      serverId,
    );

    if (!hasAccess) {
      throw new HttpException(
        'Access denied to this server',
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if user has permission to manage power
    const canManagePower = await this.userService.hasPermission(
      user.id,
      'canManagePower',
    );

    if (!canManagePower) {
      throw new HttpException(
        'You do not have permission to manage server power',
        HttpStatus.FORBIDDEN,
      );
    }

    const result = await this.hetznerService.powerOffServer(serverId);
    return {
      message: 'Server power off initiated',
      action: result.action,
    };
  }

  @Post(':id/reboot')
  @HttpCode(HttpStatus.OK)
  async reboot(@Param('id') serverId: string, @CurrentUser() user: any) {
    const hasAccess = await this.serverService.hasServerAccess(
      user.id,
      serverId,
    );

    if (!hasAccess) {
      throw new HttpException(
        'Access denied to this server',
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if user has permission to manage power
    const canManagePower = await this.userService.hasPermission(
      user.id,
      'canManagePower',
    );

    if (!canManagePower) {
      throw new HttpException(
        'You do not have permission to manage server power',
        HttpStatus.FORBIDDEN,
      );
    }

    const result = await this.hetznerService.rebootServer(serverId);
    return {
      message: 'Server reboot initiated',
      action: result.action,
    };
  }

  @Get(':id/metrics')
  async getServerMetrics(
    @Param('id') serverId: string,
    @CurrentUser() user: any,
  ) {
    const hasAccess = await this.serverService.hasServerAccess(
      user.id,
      serverId,
    );

    if (!hasAccess) {
      throw new HttpException(
        'Access denied to this server',
        HttpStatus.FORBIDDEN,
      );
    }

    // Check if user has permission to view metrics
    const canViewMetrics = await this.userService.hasPermission(
      user.id,
      'canViewMetrics',
    );

    if (!canViewMetrics) {
      throw new HttpException(
        'You do not have permission to view server metrics',
        HttpStatus.FORBIDDEN,
      );
    }

    // TODO: Implement actual metrics fetching from Hetzner API
    // For now, return mock data
    return {
      serverId,
      cpu: {
        usage: 45.5,
        cores: 2,
      },
      memory: {
        used: 2147483648, // 2GB in bytes
        total: 4294967296, // 4GB in bytes
        usage: 50,
      },
      network: {
        inbound: 1048576, // 1MB/s
        outbound: 524288, // 512KB/s
      },
      timestamp: new Date().toISOString(),
    };
  }
}
