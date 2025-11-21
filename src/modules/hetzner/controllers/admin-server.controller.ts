import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ServerService } from '../server.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { ApiTokenDto } from '../dto/api-token.dto';
import { AssignServerDto } from '../dto/assign-server.dto';

@Controller('admin/servers')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminServerController {
  constructor(private readonly serverService: ServerService) {}

  @Get()
  async getAllServers() {
    return await this.serverService.getAllServersWithAssignments();
  }

  @Post('assign')
  @HttpCode(HttpStatus.CREATED)
  async assignServer(@Body() assignServerDto: AssignServerDto) {
    return await this.serverService.assignServer(
      assignServerDto.serverId,
      assignServerDto.userId,
    );
  }

  @Delete('assign/:serverId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassignServer(@Param('serverId') serverId: string) {
    await this.serverService.unassignServer(serverId);
  }

  @Post('api-token')
  @HttpCode(HttpStatus.OK)
  async saveApiToken(@Body() apiTokenDto: ApiTokenDto) {
    await this.serverService.saveApiToken(apiTokenDto.token);
    return { message: 'API token saved successfully' };
  }

  @Get('api-token')
  async getApiToken() {
    const tokenData = await this.serverService.getApiToken();
    if (!tokenData) {
      return { configured: false };
    }
    return {
      configured: true,
      maskedToken: tokenData.masked,
    };
  }
}
