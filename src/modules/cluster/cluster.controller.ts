import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ClusterService } from './cluster.service';
import {
  AssignPagesDto,
  CreateClusterDto,
  SetRepresentativesDto,
  TogglePageRepresentativeDto,
  UpdateClusterDto,
} from './cluster.dto';

@Controller('clusters')
export class ClusterController {
  constructor(private readonly clusterService: ClusterService) {}

  @Get()
  findAll() {
    return this.clusterService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: number) {
    return this.clusterService.findById(id);
  }

  @Get(':id/pages')
  getPages(@Param('id') id: number) {
    return this.clusterService.getPages(id);
  }

  @Post()
  create(@Body() dto: CreateClusterDto) {
    return this.clusterService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateClusterDto) {
    return this.clusterService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.clusterService.remove(id);
  }

  @Post(':id/pages')
  assignPages(@Param('id') id: number, @Body() dto: AssignPagesDto) {
    return this.clusterService.assignPages(id, dto);
  }

  @Delete(':id/pages')
  removePages(@Param('id') id: number, @Body() dto: AssignPagesDto) {
    return this.clusterService.removePages(id, dto);
  }

  @Put(':id/representatives')
  setRepresentatives(
    @Param('id') id: number,
    @Body() dto: SetRepresentativesDto,
  ) {
    return this.clusterService.setRepresentatives(id, dto);
  }

  @Patch(':id/pages/:pageId/representative')
  togglePageRepresentative(
    @Param('id') id: number,
    @Param('pageId') pageId: number,
    @Body() dto: TogglePageRepresentativeDto,
  ) {
    return this.clusterService.togglePageRepresentative(id, pageId, dto);
  }
}
