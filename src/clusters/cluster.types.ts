import { Cluster as ClusterEntity } from '../modules/cluster/cluster.entity';

/**
 * انواع و ثابت‌های مشترک ClustersModule (design §5.4).
 *
 * مفهوم «Cluster» (خوشهٔ مدیریت‌شدهٔ منابع به‌همراه نمایندگان) دقیقاً روی همان
 * جدول `clusters` نگاشت می‌شود. برای جلوگیری از تعارض metadata در TypeORM (دو
 * کلاس روی یک جدول)، به‌جای تعریف یک entity دوم، همان موجودیت موجود `Cluster`
 * دوباره استفاده می‌شود و در این لایه با همان نام مفهومی در دسترس قرار می‌گیرد —
 * دقیقاً مطابق الگوی `Source = Page` در `SourcesModule` (تسک ۳.۴) و
 * `ContentItem = Post` در `ContentModule` (تسک ۳.۷).
 */
export type Cluster = ClusterEntity;

/**
 * خوشه به‌همراه آمار سریع (تعداد منابع و تعداد نمایندگان). خروجی `findAll`.
 */
export interface ClusterWithStats extends Cluster {
  /** تعداد منابع (pages) عضو این خوشه. */
  pages_count: number;
  /** تعداد منابعِ نماینده (`is_representative = true`) درون این خوشه. */
  representatives_count: number;
}

/**
 * جزئیات یک خوشه به‌همراه فهرست منابع عضو و آمار. خروجی `findById`.
 *
 * فیلد `pages` (رابطهٔ موجودیت `Cluster`) با فهرست واقعی منابع عضو پر می‌شود؛
 * نوع آن همان `Cluster['pages']` نگه داشته شده تا با موجودیت سازگار بماند.
 */
export interface ClusterDetail extends Cluster {
  pages_count: number;
  representatives_count: number;
}

/** نتیجهٔ عملیات دسته‌ای روی منابع یک خوشه (assign/remove pages). */
export interface ClusterBulkResult {
  /** تعداد منابعی که تحت تأثیر عملیات قرار گرفتند. */
  updated: number;
}
