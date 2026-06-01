import { OutputSchemaDescriptor, PromptResponseFormat } from '../ai/ai.types';
import {
  PROMPT_AI_SYNTHESIZER,
  PROMPT_ALERT_GENERATION,
  PROMPT_OCR,
  PROMPT_PAGE_ANALYSIS,
  PROMPT_PAGE_NARRATIVE,
  PROMPT_REPORT_GENERATION,
} from '../modules/settings/prompt-defaults';

/**
 * توصیف‌گر seed برای یک prompt اولیه (Requirement 6.1).
 *
 * هر مدخل یک `PromptDefinition` و یک نسخهٔ اولیه (version = 1, is_active = true)
 * می‌سازد. در جایی که متن canonical در `settings/prompt-defaults.ts` موجود است،
 * همان به‌عنوان تمپلیت اولیه استفاده می‌شود؛ در غیر این صورت یک تمپلیت placeholder
 * مختصر و معقول قرار می‌گیرد تا بعداً از طریق Prompt Studio نسخه‌بندی شود.
 */
export interface PromptSeedDefinition {
  key: string;
  title: string;
  description: string;
  category: string;
  default_model: string;
  output_schema?: OutputSchemaDescriptor | null;
  template: string;
  extra_instructions?: string;
  temperature?: number;
  response_format: PromptResponseFormat;
}

/** مدل پیش‌فرض هم‌راستا با `AiService.fallbackModel`. */
const DEFAULT_MODEL = 'google/gemini-2.5-pro';

/**
 * تمپلیت placeholder مختصر برای promptهایی که هنوز متن canonical ندارند. متن
 * عمداً ساده نگه داشته شده تا admin بعداً نسخهٔ واقعی را در Prompt Studio بسازد.
 */
function placeholderTemplate(purpose: string): string {
  return [
    `تو یک تحلیل‌گر ارشد رسانه‌ای و عملیات روایت هستی.`,
    `وظیفه: ${purpose}`,
    ``,
    `داده ورودی:`,
    `{{input}}`,
    ``,
    `فقط و فقط JSON معتبر برگردان. هیچ متن اضافه، markdown یا توضیحی ننویس.`,
  ].join('\n');
}

/**
 * ۱۰ prompt اولیهٔ seed‌شده (Requirement 6.1 / design §5.7).
 *
 * ترتیب با فهرست acceptance criteria هم‌خوان است. هر مدخل idempotent بر اساس
 * یکتایی `key` در جدول `prompt_definitions` seed می‌شود.
 */
export const PROMPT_SEED_DEFINITIONS: PromptSeedDefinition[] = [
  {
    key: 'content_analysis',
    title: 'تحلیل محتوای منبع',
    description:
      'تحلیل ساختاریافتهٔ یک صفحه/کانال و پست‌های آن (احساسات، موضوعات، امتیازها، persona).',
    category: 'analysis',
    default_model: DEFAULT_MODEL,
    template: PROMPT_PAGE_ANALYSIS,
    temperature: 0.3,
    response_format: 'json',
    output_schema: {
      type: 'object',
      required: ['posts_analysis'],
    },
  },
  {
    key: 'ocr_extraction',
    title: 'استخراج متن از تصویر (OCR)',
    description:
      'استخراج دقیق متن قابل‌مشاهده از تصویر بدون ترجمه، خلاصه‌سازی یا تفسیر.',
    category: 'extraction',
    default_model: DEFAULT_MODEL,
    template: PROMPT_OCR,
    temperature: 0,
    response_format: 'text',
    output_schema: null,
  },
  {
    key: 'transcription_translation',
    title: 'رونویسی و ترجمهٔ محتوای صوتی/تصویری',
    description:
      'رونویسی محتوای صوتی/ویدیویی و ترجمهٔ آن به فارسی به‌صورت دقیق و طبیعی.',
    category: 'extraction',
    default_model: DEFAULT_MODEL,
    template: [
      `تو یک رونویس و مترجم حرفه‌ای محتوای صوتی و تصویری هستی.`,
      `متن زیر رونوشت خام یک محتوای صوتی/ویدیویی است. آن را تمیز کن و در صورت غیرفارسی بودن، ترجمهٔ فارسی دقیق و طبیعی ارائه بده.`,
      ``,
      `رونوشت خام:`,
      `{{transcript}}`,
      ``,
      `فقط JSON معتبر با کلیدهای "transcription" و "translation_fa" برگردان.`,
    ].join('\n'),
    temperature: 0.2,
    response_format: 'json',
    output_schema: {
      type: 'object',
      required: ['transcription', 'translation_fa'],
    },
  },
  {
    key: 'source_narrative_insight',
    title: 'بصیرت روایی منبع (پنل ۳۶۰ درجه)',
    description:
      'تولید پنل ۳۶۰ درجهٔ بصیرت برای یک منبع شامل توصیف روایت، توزیع موضوعی و پیشنهاد تعامل.',
    category: 'insight',
    default_model: DEFAULT_MODEL,
    template: PROMPT_PAGE_NARRATIVE,
    temperature: 0.4,
    response_format: 'json',
    output_schema: {
      type: 'object',
      required: ['narrative_description', 'topic_distribution'],
    },
  },
  {
    key: 'network_ai_summary',
    title: 'خلاصهٔ هوشمند شبکه',
    description:
      'تولید یک جملهٔ مدیریتی کوتاه که خلاصهٔ وضعیت امروز شبکه را بیان می‌کند.',
    category: 'network',
    default_model: DEFAULT_MODEL,
    template: PROMPT_AI_SYNTHESIZER,
    temperature: 0.5,
    response_format: 'text',
    output_schema: null,
  },
  {
    key: 'strategic_alert_generation',
    title: 'تولید هشدار استراتژیک',
    description:
      'تولید هشدارهای استراتژیک قابل‌اقدام بر اساس سیگنال‌های قابل‌مشاهده در داده‌های شبکه.',
    category: 'operations',
    default_model: DEFAULT_MODEL,
    template: PROMPT_ALERT_GENERATION,
    temperature: 0.4,
    response_format: 'json',
    output_schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'message', 'priority', 'category', 'playbook'],
      },
    },
  },
  {
    key: 'periodic_report_generation',
    title: 'تولید گزارش دوره‌ای',
    description:
      'تولید گزارش تحلیلی مدیریتی از وضعیت شبکه در یک بازهٔ زمانی مشخص.',
    category: 'reporting',
    default_model: DEFAULT_MODEL,
    template: PROMPT_REPORT_GENERATION,
    temperature: 0.4,
    response_format: 'json',
    output_schema: {
      type: 'object',
      required: ['headline', 'report', 'mood'],
    },
  },
  {
    key: 'silence_radar',
    title: 'رادار سکوت',
    description:
      'شناسایی موضوعات مهمی که شبکه نسبت به آن‌ها کم‌واکنش یا ساکت بوده است.',
    category: 'insight',
    default_model: DEFAULT_MODEL,
    template: placeholderTemplate(
      'موضوعات مهمی که شبکه به آن‌ها کم‌توجهی کرده (شکاف سکوت) را شناسایی کن و برای هر کدام اهمیت و دلیل کم‌توجهی را توضیح بده.',
    ),
    temperature: 0.4,
    response_format: 'json',
    output_schema: {
      type: 'object',
      required: ['silence_gaps'],
    },
  },
  {
    key: 'narrative_battle',
    title: 'نبرد روایت‌ها',
    description:
      'تحلیل روایت‌های رقیب در یک موضوع و سنجش توان نسبی هر روایت در شبکه.',
    category: 'insight',
    default_model: DEFAULT_MODEL,
    template: placeholderTemplate(
      'روایت‌های رقیب پیرامون یک موضوع را شناسایی کن، توان نسبی هر روایت و صفحات حامل آن را تحلیل کن.',
    ),
    temperature: 0.4,
    response_format: 'json',
    output_schema: {
      type: 'object',
      required: ['narratives'],
    },
  },
  {
    key: 'smart_recommendations',
    title: 'پیشنهادهای هوشمند',
    description:
      'تولید پیشنهادهای عملیاتی هوشمند بر اساس وضعیت فعلی شبکه و فرصت‌ها/ریسک‌ها.',
    category: 'operations',
    default_model: DEFAULT_MODEL,
    template: placeholderTemplate(
      'بر اساس وضعیت فعلی شبکه، پیشنهادهای عملیاتی هوشمند و قابل‌اجرا (همراه با دلیل و اولویت) تولید کن.',
    ),
    temperature: 0.5,
    response_format: 'json',
    output_schema: {
      type: 'object',
      required: ['recommendations'],
    },
  },
];
