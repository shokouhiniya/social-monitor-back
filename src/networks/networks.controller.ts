import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { NetworksService } from './networks.service';
import { CreateNetworkDto, UpdateNetworkDto } from './networks.dto';

/**
 * کنترلر network ها. صرفاً داده برمی‌گرداند؛ بسته‌بندی Response Envelope توسط
 * ResponseInterceptor سراسری انجام می‌شود (Requirement 12.1).
 */
@Controller('networks')
export class NetworksController {
  constructor(private readonly networksService: NetworksService) {}

  @Get()
  findAll() {
    return this.networksService.findAll();
  }

  @Get('default')
  getDefault() {
    return this.networksService.getDefault();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.networksService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateNetworkDto) {
    return this.networksService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNetworkDto,
  ) {
    return this.networksService.update(id, dto);
  }
}
