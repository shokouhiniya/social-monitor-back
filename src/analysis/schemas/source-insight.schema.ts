import { OutputSchemaDescriptor } from '../../ai/ai.types';

/**
 * Schema خروجی بینش منبع (design §6.6 — `SourceInsightOutput`).
 *
 * شکل مورد انتظار خروجی مدل برای prompt `source_narrative_insight`. توسط
 * `AnalysisService.generateSourceInsight` در `source_insight_results` ذخیره
 * می‌شود (Requirement 7.3).
 */
export interface SourceInsightOutput {
  narrative_description: string;
  audience_description: string;
  engagement_suggestion: string;
  persona_radar: {
    ideological: number;
    emotional: number;
    mobilizing: number;
    credible: number;
    polarizing: number;
    pragmatic: number;
  };
  pain_points: string[];
  topic_distribution: Array<{ topic: string; weight: number }>;
  strategic_notes: string[];
}

/**
 * توصیف‌گر سبک schema خروجی بینش منبع برای اعتبارسنجی عمل‌گرایانه
 * (Requirement 5.4 / 7.5). `narrative_description` و `topic_distribution`
 * فیلدهای هستهٔ الزامی‌اند (هم‌راستا با seed `source_narrative_insight`).
 */
export const SOURCE_INSIGHT_OUTPUT_SCHEMA: OutputSchemaDescriptor = {
  type: 'object',
  required: ['narrative_description', 'topic_distribution'],
  properties: {
    narrative_description: { type: 'string' },
    audience_description: { type: 'string' },
    engagement_suggestion: { type: 'string' },
    persona_radar: { type: 'object' },
    pain_points: { type: 'array', items: { type: 'string' } },
    topic_distribution: { type: 'array', items: { type: 'object' } },
    strategic_notes: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * استخراج امن مقادیر `SourceInsightOutput` از مقدار parse‌شدهٔ نامطمئن. مقاوم در
 * برابر فیلدهای غایب؛ هرگز throw نمی‌کند.
 */
export function extractSourceInsight(
  parsed: unknown,
): SourceInsightOutput | null {
  if (parsed === null || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  return {
    narrative_description:
      typeof obj.narrative_description === 'string'
        ? obj.narrative_description
        : '',
    audience_description:
      typeof obj.audience_description === 'string'
        ? obj.audience_description
        : '',
    engagement_suggestion:
      typeof obj.engagement_suggestion === 'string'
        ? obj.engagement_suggestion
        : '',
    persona_radar: extractPersonaRadar(obj.persona_radar),
    pain_points: toStringArray(obj.pain_points),
    topic_distribution: extractTopicDistribution(obj.topic_distribution),
    strategic_notes: toStringArray(obj.strategic_notes),
  };
}

/** کلیدهای محور persona (design §6.6). */
const PERSONA_KEYS = [
  'ideological',
  'emotional',
  'mobilizing',
  'credible',
  'polarizing',
  'pragmatic',
] as const;

/** استخراج امن persona_radar با مقادیر عددی پیش‌فرض ۰. */
function extractPersonaRadar(
  value: unknown,
): SourceInsightOutput['persona_radar'] {
  const radar: SourceInsightOutput['persona_radar'] = {
    ideological: 0,
    emotional: 0,
    mobilizing: 0,
    credible: 0,
    polarizing: 0,
    pragmatic: 0,
  };
  if (value === null || typeof value !== 'object') return radar;
  const obj = value as Record<string, unknown>;
  for (const key of PERSONA_KEYS) {
    const n = Number(obj[key]);
    if (Number.isFinite(n)) radar[key] = n;
  }
  return radar;
}

/** استخراج امن topic_distribution (آیتم‌های نامعتبر فیلتر می‌شوند). */
function extractTopicDistribution(
  value: unknown,
): Array<{ topic: string; weight: number }> {
  if (!Array.isArray(value)) return [];
  const result: Array<{ topic: string; weight: number }> = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const topic = typeof obj.topic === 'string' ? obj.topic : null;
    if (!topic) continue;
    const weight = Number(obj.weight);
    result.push({ topic, weight: Number.isFinite(weight) ? weight : 0 });
  }
  return result;
}

/** تبدیل امن یک مقدار نامطمئن به آرایهٔ رشته‌ای. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
