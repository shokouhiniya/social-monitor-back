import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto, PostQueryDto } from './post.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  findAll(@Query() query: PostQueryDto) {
    return this.postService.findAll(query);
  }

  @Get('analytics/trending-keywords')
  getTrendingKeywords(@Query('days') days: number) {
    return this.postService.getTrendingKeywords(days);
  }

  @Get('analytics/sentiment-timeline')
  getSentimentTimeline(
    @Query('page_id') pageId: number,
    @Query('days') days: number,
  ) {
    return this.postService.getSentimentTimeline(pageId, days);
  }

  @Get('analytics/topic-gravity')
  getTopicGravity(@Query('days') days: number) {
    return this.postService.getTopicGravity(days);
  }

  @Get('analytics/reshare-tree')
  getReshareTree(@Query('days') days: number) {
    return this.postService.getReshareTree(days);
  }

  @Get('feed')
  getPostsFeed(@Query() query: any) {
    return this.postService.getPostsFeed(query);
  }

  @Get('topic-clusters')
  getTopicClusters() {
    return this.postService.getTopicClusters();
  }

  @Get(':id')
  findById(@Param('id') id: number) {
    return this.postService.findById(id);
  }

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.postService.create(dto);
  }

  @Post('bulk')
  createBulk(@Body() dtos: CreatePostDto[]) {
    return this.postService.createBulk(dtos);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.postService.remove(id);
  }
}
