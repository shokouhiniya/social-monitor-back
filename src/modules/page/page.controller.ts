import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PageService } from './page.service';
import { CreatePageDto, UpdatePageDto, PageQueryDto } from './page.dto';

@Controller('pages')
export class PageController {
  constructor(private readonly pageService: PageService) {}

  @Get()
  findAll(@Query() query: PageQueryDto) {
    return this.pageService.findAll(query);
  }

  @Get('analytics/categories')
  getCategoryDistribution() {
    return this.pageService.getCategoryDistribution();
  }

  @Get('analytics/clusters')
  getClusterDistribution() {
    return this.pageService.getClusterDistribution();
  }

  @Get('analytics/countries')
  getCountryDistribution() {
    return this.pageService.getCountryDistribution();
  }

  @Get('analytics/top-influencers')
  getTopInfluencers(@Query('limit') limit: number) {
    return this.pageService.getTopInfluencers(limit);
  }

  @Get('analytics/segments')
  getSegmentCounts() {
    return this.pageService.getSegmentCounts();
  }

  @Get(':id/related')
  getRelatedPages(@Param('id') id: number) {
    return this.pageService.getRelatedPages(id);
  }

  @Get(':id')
  findById(@Param('id') id: number) {
    return this.pageService.findById(id);
  }

  @Post()
  create(@Body() dto: CreatePageDto) {
    return this.pageService.create(dto);
  }

  @Post('bulk')
  createBulk(@Body() dtos: CreatePageDto[]) {
    return this.pageService.createBulk(dtos);
  }

  @Post(':id/fetch')
  fetchPageData(@Param('id') id: number) {
    return this.pageService.fetchPageData(id);
  }

  @Post(':id/process')
  processPageData(@Param('id') id: number) {
    return this.pageService.processWithLLM(id);
  }

  @Get(':id/export')
  async exportPageData(@Param('id') id: number) {
    return this.pageService.exportPageData(id);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdatePageDto) {
    return this.pageService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.pageService.remove(id);
  }
}
