/**
 * لایهٔ صفحه‌بندی مشترک (`common/pagination`).
 *
 * صادرکنندهٔ:
 *  - `PaginationQueryDto` — DTO مبتنی بر class-validator برای endpoint های لیستی.
 *  - `PaginationPipe` — pipe تبدیل query خام به `NormalizedPagination`.
 *  - `normalizePagination` / `paginate` / `paginateArray` — util های صفحه‌بندی.
 *  - انواع و ثابت‌های مشترک.
 */
export * from './pagination.types';
export * from './pagination.util';
export * from './pagination-query.dto';
export * from './pagination.pipe';
