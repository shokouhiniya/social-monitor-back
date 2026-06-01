import { OutputSchemaDescriptor } from '../../ai/ai.types';

/**
 * Schema خروجی تحلیل محتوا (design §6.5 — `ContentAnalysisOutput`).
 *
 * این interface شکل مورد انتظار خروجی مدل برای prompt `content_analysis` است.
 * `AnalysisService.analyzeContent` این شکل را از `AiExecutionResult.parsed`
 * استخراج و در `content_analysis_results` ذخیره می‌کند (Requirement 7.1).
 */
export interface ContentAnalysisOutput {
  sentiment: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    reason: string;
  };
  keywords: string[];
  topics: string[];
  summary_fa: string;
  is_relevant: boolean;
  coverage_type:
    | 'criticism'
    | 'praise'
    | 'neutral_mention'
    | 'analysis'
    | 'interview'
    | 'report'
    | 'quote';
  narrative_position: string;
  risk_level: 'low' | 'medium' | 'high';
  recommended_attention: 'normal' | 'watch' | 'urgent';
}

/**
 * توصیف‌گر سبک schema خروجی تحلیل محتوا برای اعتبارسنجی عمل‌گرایانه در
 * `AiService.validateAgainstSchema` (Requirement 5.4 / 7.5).
 *
 * تنها فیلدهای هستهٔ تصمیم‌ساز الزامی شده‌اند (`sentiment`, `keywords`) تا
 * اعتبارسنجی محکم ولی غیرشکننده بماند؛ سایر فیلدها اختیاری و در صورت وجود
 * type-check می‌شوند. این توصیف‌گر به‌عنوان fallback استفاده می‌شود اگر
 * `PromptDefinition.output_schema` برای این prompt تعریف نشده باشد.
 */
export const CONTENT_ANALYSIS_OUTPUT_SCHEMA: OutputSchemaDescriptor = {
  type: 'object',
  required: ['sentiment', 'keywords'],
  properties: {
    sentiment: { type: 'object', required: ['score', 'label'] },
    keywords: { type: 'array', items: { type: 'string' } },
    topics: { type: 'array', items: { type: 'string' } },
    summary_fa: { type: 'string' },
    is_relevant: { type: 'boolean' },
    coverage_type: { type: 'string' },
    narrative_position: { type: 'string' },
    risk_level: { type: 'string' },
    recommended_attention: { type: 'string' },
  },
};

/** برچسب‌های احساس مجاز برای نرمال‌سازی خروجی مدل. */
const SENTIMENT_LABELS = ['positive', 'neutral', 'negative'] as const;

/**
 * استخراج امن مقادیر `ContentAnalysisOutput` از یک مقدار parse‌شدهٔ نامطمئن.
 *
 * این تابع خالص فرض می‌کند ورودی پیش‌تر در برابر schema اعتبارسنجی شده است؛ با
 * این حال در برابر فیلدهای غایب/نامعتبر مقاوم است و مقادیر پیش‌فرض امن می‌گذارد.
 * هرگز throw نمی‌کند.
 */
export function extractContentAnalysis(
  parsed: unknown,
): ContentAnalysisOutput | null {
  if (parsed === null || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const sentimentRaw = obj.sentiment;
  if (sentimentRaw === null || typeof sentimentRaw !== 'object') return null;
  const sentiment = sentimentRaw as Record<string, unknown>;

  const score = Number(sentiment.score);
  const labelRaw = String(sentiment.label ?? 'neutral');
  const label = (
    SENTIMENT_LABELS as readonly string[]
  ).includes(labelRaw)
    ? (labelRaw as ContentAnalysisOutput['sentiment']['label'])
    : 'neutral';

  return {
    sentiment: {
      score: Number.isFinite(score) ? score : 0,
      label,
      reason: typeof sentiment.reason === 'string' ? sentiment.reason : '',
    },
    keywords: toStringArray(obj.keywords),
    topics: toStringArray(obj.topics),
    summary_fa: typeof obj.summary_fa === 'string' ? obj.summary_fa : '',
    is_relevant: obj.is_relevant !== false,
    coverage_type:
      (typeof obj.coverage_type === 'string'
        ? obj.coverage_type
        : 'neutral_mention') as ContentAnalysisOutput['coverage_type'],
    narrative_position:
      typeof obj.narrative_position === 'string' ? obj.narrative_position : '',
    risk_level: (typeof obj.risk_level === 'string'
      ? obj.risk_level
      : 'low') as ContentAnalysisOutput['risk_level'],
    recommended_attention: (typeof obj.recommended_attention === 'string'
      ? obj.recommended_attention
      : 'normal') as ContentAnalysisOutput['recommended_attention'],
  };
}

/** تبدیل امن یک مقدار نامطمئن به آرایهٔ رشته‌ای (مقادیر غیررشته‌ای فیلتر می‌شوند). */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
