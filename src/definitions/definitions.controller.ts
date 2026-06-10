import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DefinitionsService } from './definitions.service';
import { CreateDefinitionDto, UpdateDefinitionDto } from './definitions.dto';
import { Roles } from '../auth/roles.decorator';

/**
 * کنترلر تعاریف مرجع (`/definitions`) — پنل «تعاریف» در بخش سیستم.
 * خواندن برای همهٔ کاربران احرازشده باز است؛ نوشتن مخصوص super_admin/admin
 * (هنگام AUTH_ENFORCE). مسیر `/definitions` به NEW_ROUTE_PREFIXES افزوده شده است.
 */
@Controller('definitions')
export class DefinitionsController {
  constructor(private readonly service: DefinitionsService) {}

  @Get()
  list(
    @Query('type') type?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.list(type, includeInactive === 'true');
  }

  @Roles('super_admin', 'admin')
  @Post()
  create(@Body() dto: CreateDefinitionDto) {
    return this.service.create(dto);
  }

  @Roles('super_admin', 'admin')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDefinitionDto) {
    return this.service.update(id, dto);
  }

  @Roles('super_admin', 'admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
