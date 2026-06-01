import { Injectable, PipeTransform } from '@nestjs/common';
import { NormalizedPagination, PaginationInput } from './pagination.types';
import { normalizePagination } from './pagination.util';

/**
 * Pipe مشترک صفحه‌بندی.
 *
 * مقادیر خام `page`/`pageSize` (که می‌توانند string یا undefined باشند) را به یک
 * `NormalizedPagination` با مقادیر مؤثر تبدیل می‌کند: `page >= 1`،
 * `1 <= pageSize <= 100` با پیش‌فرض ۲۰، و `skip`/`take` آمادهٔ استفاده در query.
 *
 * نمونهٔ استفاده در یک controller:
 *
 * ```ts
 * @Get()
 * findAll(@Query(PaginationPipe) pagination: NormalizedPagination) {
 *   return this.service.findPaginated(pagination);
 * }
 * ```
 *
 * Requirement 12.6: clamp مقدار `pageSize` در بازهٔ `[1, 100]` و `page >= 1`.
 */
@Injectable()
export class PaginationPipe
  implements PipeTransform<PaginationInput, NormalizedPagination>
{
  transform(value: PaginationInput): NormalizedPagination {
    return normalizePagination(value ?? {});
  }
}
