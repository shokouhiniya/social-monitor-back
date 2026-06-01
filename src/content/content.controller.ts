import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ContentService } from './content.service';
import {
  ContentFeedQuery,
  HighImpactQuery,
  UpdateContextDto,
} from './content.dto';

/**
 * کنترلر محتوا (ContentController — design §5.3 / §7.2).
 *
 * بسته‌بندی Response Envelope توسط ResponseInterceptor سراسری و نگاشت خطا توسط
 * AllExceptionsFilter انجام می‌شود (Requirement 12). مسیرهای ارائه‌شده:
 *  - GET   /content            — فید صفحه‌بندی‌شده با فیلترها (Requirement 3.1)
 *  - GET   /content/feed       — نام مستعار فید (هم‌خوان با مسیر legacy `/posts/feed`)
 *  - GET   /content/high-impact— محتوای پراثر مرتب‌شده (Requirement 3.4)
 *  - GET   /content/:id        — جزئیات یک ContentItem (Requirement 3.2)
 *  - PATCH /content/:id/context— ثبت زمینهٔ دستی (Requirement 3.3)
 *
 * توجه: مسیر `/content/:id/analyze` اینجا تعریف نمی‌شود؛ اتصال تحلیل در فاز ۳
 * (تسک‌های ۵.۸/۵.۱۱) انجام می‌شود.
 */
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  /** GET /content — فید صفحه‌بندی‌شدهٔ محتوا با فیلترهای اختیاری. */
  @Get()
  findFeed(@Query() query: ContentFeedQuery) {
    return this.contentService.findFeed(query);
  }

  /** GET /content/feed — نام مستعار فید (سازگاری با مسیر legacy `/posts/feed`). */
  @Get('feed')
  feed(@Query() query: ContentFeedQuery) {
    return this.contentService.findFeed(query);
  }

  /** GET /content/high-impact — محتوای پراثر مرتب‌شده بر اساس معیار اثرگذاری. */
  @Get('high-impact')
  getHighImpact(@Query() query: HighImpactQuery) {
    return this.contentService.getHighImpact(query);
  }

  /** GET /content/:id — جزئیات یک ContentItem به‌همراه metadata/metrics. */
  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.findById(id);
  }

  /** PATCH /content/:id/context — ثبت زمینهٔ دستی برای یک ContentItem. */
  @Patch(':id/context')
  updateContext(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContextDto,
  ) {
    return this.contentService.updateContext(id, dto.manualContext);
  }
}
