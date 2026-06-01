import { OutputSchemaDescriptor } from '../../ai/ai.types';

/**
 * Schema خروجی گزارش شبکه (design §5.8، Requirement 7.4).
 *
 * شکل خروجی گزارش سطح شبکه. prompt پیش‌فرض (`network_ai_summary`) قالب `text`
 * دارد و یک جملهٔ مدیریتی برمی‌گرداند؛ در صورت استفاده از
 * `periodic_report_generation` (قالب `json`) خروجی ساختاریافته شامل
 * `headline`/`report`/`mood` خواهد بود. این interface هر دو حالت را پوشش می‌دهد
 * و بدنهٔ کامل در ستون `report` (jsonb) ذخیره می‌شود.
 */
export interface NetworkReportOutput {
  /** تیتر/جملهٔ کوتاه مدیریتی (در حالت text، کل خروجی اینجا قرار می‌گیرد). */
  headline?: string;
  /** بدنهٔ تحلیلی گزارش. */
  report?: string;
  /** حال‌وهوای کلی شبکه (مثلاً مثبت/خنثی/پرتنش). */
  mood?: string;
  /** بدنهٔ کامل خروجی structured (هر شکل اضافه‌ای که مدل برگرداند). */
  [key: string]: unknown;
}

/**
 * توصیف‌گر سبک schema گزارش شبکه برای اعتبارسنجی در حالت structured. هنگام
 * استفاده از prompt متنی (`network_ai_summary`) این schema اعمال نمی‌شود (چون
 * `response_format = 'text'`)؛ تنها هنگام استفاده از prompt ساختاریافته معنا
 * دارد. هیچ فیلدی الزامی نشده تا با هر دو حالت سازگار بماند.
 */
export const NETWORK_REPORT_OUTPUT_SCHEMA: OutputSchemaDescriptor = {
  type: 'object',
};

/**
 * نرمال‌سازی خروجی گزارش شبکه به یک آبجکت قابل‌ذخیره در ستون `report` (jsonb).
 *
 *  - اگر خروجی یک string باشد (حالت متنی `network_ai_summary`)، در
 *    `{ headline: <text> }` بسته‌بندی می‌شود.
 *  - اگر یک object باشد، همان object برگردانده می‌شود.
 *  - در غیر این صورت یک object تهی برگردانده می‌شود.
 *
 * هرگز throw نمی‌کند.
 */
export function normalizeNetworkReport(parsed: unknown): NetworkReportOutput {
  if (typeof parsed === 'string') {
    return { headline: parsed, report: parsed };
  }
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as NetworkReportOutput;
  }
  if (Array.isArray(parsed)) {
    return { items: parsed } as NetworkReportOutput;
  }
  return {};
}
