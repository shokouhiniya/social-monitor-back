import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './settings.entity';
import {
  PROMPT_PAGE_ANALYSIS,
  PROMPT_PAGE_NARRATIVE,
  PROMPT_ALERT_GENERATION,
  PROMPT_REPORT_GENERATION,
  PROMPT_AI_SYNTHESIZER,
  PROMPT_OCR,
} from './prompt-defaults';

const DEFAULT_SETTINGS = [
  // Tokens & API Keys
  { key: 'rapidapi_key', value: '', category: 'tokens', label: 'RapidAPI Key (اینستاگرام)', description: 'کلید API برای دسترسی به instagram120 از طریق RapidAPI — برای واکشی پروفایل، پست‌ها و استوری‌های اینستاگرام لازم است. از rapidapi.com دریافت کنید.' },
  { key: 'openrouter_key', value: '', category: 'tokens', label: 'OpenRouter API Key (هوش مصنوعی)', description: 'کلید API برای دسترسی به مدل‌های زبانی (GPT, Gemini, Claude و …) از طریق openrouter.ai — برای تحلیل پیج‌ها، تولید گزارش و هشدار لازم است.' },
  { key: 'soniox_key', value: '', category: 'tokens', label: 'Soniox API Key (رونوشت صوتی)', description: 'کلید API سرویس Soniox برای رونوشت‌برداری از ویدیوها و استوری‌ها — اگر ندارید، بخش رونوشت ویدیو غیرفعال می‌شود.' },
  { key: 'llm_model', value: 'google/gemini-2.5-pro', category: 'tokens', label: 'مدل LLM اصلی', description: 'مدل هوش مصنوعی برای تحلیل پیج، تولید گزارش و هشدار. پیشنهادی‌ها: google/gemini-2.5-pro (دقیق، گران‌تر) یا google/gemini-2.0-flash-001 (سریع، ارزان‌تر) یا openai/gpt-4o' },
  { key: 'llm_model_fast', value: 'google/gemini-2.0-flash-001', category: 'tokens', label: 'مدل LLM سریع (OCR و خلاصه)', description: 'مدل سبک‌تر برای کارهای ساده مثل استخراج متن از تصویر و تولید خلاصه یک جمله‌ای داشبورد.' },

  // Narrative & Topics
  {
    key: 'target_narrative',
    value: 'مقاومت,فلسطین,غزه,حقوق بشر,عدالت',
    category: 'narrative',
    label: 'کلمات کلیدی روایت مطلوب',
    description: 'لیست کلمات کلیدی که نشان‌دهنده روایت مدنظر شما هستند. سامانه میزان حضور این کلمات در پست‌های هفته اخیر را به عنوان «شاخص سلامت روایت» در داشبورد محاسبه می‌کند.',
  },
  {
    key: 'silence_radar_topics',
    value: 'غزه,اقتصاد غزه,انتخابات آمریکا,تغییرات اقلیمی,هوش مصنوعی,بحران انسانی یمن,حقوق بشر,تحریم‌ها,جنگ لبنان,مهاجرت',
    category: 'narrative',
    label: 'موضوعات پیش‌فرض رادار سکوت',
    description: 'موضوعات داغ جهانی که می‌خواهید بدانید آیا شبکه شما درباره آن‌ها پوشش داده یا سکوت کرده.',
  },
  {
    key: 'alignment_criteria',
    value: 'مخالفت با آمریکا و اسرائیل\nحمایت از مسئله فلسطین\nحمایت از لبنان و حزب‌الله\nحمایت از جمهوری اسلامی ایران\nحمایت از یمن (انصارالله)\nحمایت از مقاومت گروه‌های عراقی\nمخالفت با اسلام‌گرایی اماراتی و عربستانی',
    category: 'narrative',
    label: 'معیارهای شاخص همسویی',
    description: 'معیارهایی که هوش مصنوعی برای محاسبه «شاخص همسویی» (alignment_score) هر پیج استفاده می‌کند. هر خط یک معیار.',
  },

  // Prompts — system role for each module (latest versions)
  {
    key: 'prompt_page_analysis',
    value: PROMPT_PAGE_ANALYSIS,
    category: 'prompts',
    label: 'پرامپت تحلیل پیج',
    description: 'پرامپت سیستمی برای تحلیل هر پیج — خروجی: دسته‌بندی موضوعی، دسته هویتی، خوشه، ۵ شاخص، رادار شخصیت، اطلاعات هویتی، تحلیل پست‌ها',
  },
  {
    key: 'prompt_page_analysis_extra',
    value: '',
    category: 'prompts',
    label: 'دستورات اضافی تحلیل پیج',
    description: 'دستورات تکمیلی که به انتهای پرامپت تحلیل پیج اضافه می‌شود (اختیاری)',
  },
  {
    key: 'prompt_page_narrative',
    value: PROMPT_PAGE_NARRATIVE,
    category: 'prompts',
    label: 'پرامپت پنل ۳۶۰° بصیرت',
    description: 'پرامپت سیستمی برای تولید توصیف آزاد، توزیع موضوعی، توصیف مخاطب و پیشنهاد تعامل چندزبانه',
  },
  {
    key: 'prompt_page_narrative_extra',
    value: '',
    category: 'prompts',
    label: 'دستورات اضافی پنل ۳۶۰°',
    description: 'دستورات تکمیلی که به انتهای پرامپت پنل بصیرت اضافه می‌شود (اختیاری)',
  },
  {
    key: 'prompt_alert_generation',
    value: PROMPT_ALERT_GENERATION,
    category: 'prompts',
    label: 'پرامپت تولید هشدار',
    description: 'پرامپت سیستمی برای تولید هشدارهای استراتژیک — خروجی: عنوان، توضیح، اولویت، دسته، اقدامات',
  },
  {
    key: 'prompt_alert_generation_extra',
    value: '',
    category: 'prompts',
    label: 'دستورات اضافی تولید هشدار',
    description: 'دستورات تکمیلی که به انتهای پرامپت هشدار اضافه می‌شود (اختیاری)',
  },
  {
    key: 'prompt_report_generation',
    value: PROMPT_REPORT_GENERATION,
    category: 'prompts',
    label: 'پرامپت تولید گزارش',
    description: 'پرامپت سیستمی برای تولید گزارش دوره‌ای — خروجی: تیتر، گزارش مفصل، حال‌وهوا، موضوعات و کلمات برتر',
  },
  {
    key: 'prompt_report_generation_extra',
    value: '',
    category: 'prompts',
    label: 'دستورات اضافی تولید گزارش',
    description: 'دستورات تکمیلی که به انتهای پرامپت گزارش اضافه می‌شود (اختیاری)',
  },
  {
    key: 'prompt_ai_synthesizer',
    value: PROMPT_AI_SYNTHESIZER,
    category: 'prompts',
    label: 'پرامپت خلاصه روزانه (AI Synthesizer)',
    description: 'پرامپت برای تولید جمله یک‌خطی خلاصه وضعیت شبکه. متغیرهای {TOPICS}، {KEYWORDS}، {MOOD} و {SENTIMENT_SCORE} با مقادیر زنده جایگزین می‌شوند.',
  },
  {
    key: 'prompt_ai_synthesizer_extra',
    value: '',
    category: 'prompts',
    label: 'دستورات اضافی خلاصه روزانه',
    description: 'دستورات تکمیلی که به انتهای پرامپت خلاصه اضافه می‌شود (اختیاری)',
  },
  {
    key: 'prompt_ocr',
    value: PROMPT_OCR,
    category: 'prompts',
    label: 'پرامپت استخراج متن از تصویر (OCR)',
    description: 'پرامپت سیستمی برای استخراج متن از روی تصویر پست‌ها — هنگام «پردازش هوشمند» اجرا می‌شود.',
  },
];

// Map of prompt keys → their canonical latest values, used by migration to overwrite old defaults
const CANONICAL_PROMPTS: Record<string, string> = {
  prompt_page_analysis: PROMPT_PAGE_ANALYSIS,
  prompt_page_narrative: PROMPT_PAGE_NARRATIVE,
  prompt_alert_generation: PROMPT_ALERT_GENERATION,
  prompt_report_generation: PROMPT_REPORT_GENERATION,
  prompt_ai_synthesizer: PROMPT_AI_SYNTHESIZER,
  prompt_ocr: PROMPT_OCR,
};

// Known old-default prefixes per key — if DB value starts with any of these,
// it means the user is still on a stock old default and we can safely overwrite.
const OLD_DEFAULT_PREFIXES: Record<string, string[]> = {
  prompt_page_analysis: [
    'تو یک تحلیل‌گر ارشد رسانه‌ای هستی که در یک سیستم پایش',
    'تو یک تحلیل‌گر رسانه‌ای هوشمند هستی',
    'تو یک تحلیل‌گر ارشد رسانه‌ای هستی. اطلاعات زیر',
  ],
  prompt_page_narrative: [
    'تو یک تحلیل‌گر ارشد رسانه‌ای هستی که برای پنل ۳۶۰°',
    'تو یک تحلیل‌گر رسانه‌ای هستی. توصیف جامع',
  ],
  prompt_alert_generation: [
    'تو یک تحلیل‌گر استراتژیک رسانه‌ای هستی که در سیستم پایش',
    'تو یک تحلیل‌گر استراتژیک رسانه‌ای هستی. بر اساس دیتای زیر',
  ],
  prompt_report_generation: [
    'تو یک تحلیل‌گر ارشد رسانه‌ای هستی که گزارش‌های دوره‌ای',
    'تو یک تحلیل‌گر ارشد رسانه‌ای هستی. بر اساس دیتای زیر',
  ],
  prompt_ai_synthesizer: [
    'بر اساس اطلاعات زیر، یک جمله کوتاه و تاثیرگذار (حداکثر',
  ],
  prompt_ocr: [
    'Extract ALL visible text from this image exactly as written',
  ],
};

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(AppSettings)
    private repo: Repository<AppSettings>,
  ) {}

  async onModuleInit() {
    // Seed default settings if they don't exist
    for (const s of DEFAULT_SETTINGS) {
      const existing = await this.repo.findOne({ where: { key: s.key } });
      if (!existing) {
        await this.repo.save(this.repo.create(s));
      }
    }

    // Migrate prompts that still hold an old stock default → overwrite with the latest canonical version
    await this.migratePromptsToLatest();

    // Remove deprecated keys
    const deprecatedKeys = ['refresh_interval_hours', 'prompt_post_analysis', 'prompt_post_analysis_extra'];
    for (const key of deprecatedKeys) {
      await this.repo.delete({ key });
    }
  }

  /**
   * For each canonical prompt, if the DB still holds an old stock default
   * (matched by known prefixes), overwrite it with the latest canonical version.
   * Custom user-edited values that don't match any old prefix are left untouched.
   */
  private async migratePromptsToLatest() {
    for (const [key, latest] of Object.entries(CANONICAL_PROMPTS)) {
      const setting = await this.repo.findOne({ where: { key } });
      if (!setting) continue;

      const current = setting.value || '';
      const prefixes = OLD_DEFAULT_PREFIXES[key] || [];

      const isOldDefault = prefixes.some((p) => current.startsWith(p));
      const isEmpty = !current.trim();

      if (isOldDefault || isEmpty) {
        if (current !== latest) {
          setting.value = latest;
          await this.repo.save(setting);
          console.log(`🔄 Migrated prompt "${key}" to latest canonical version`);
        }
      }
    }
  }

  async findAll() {
    return await this.repo.find({ order: { category: 'ASC', key: 'ASC' } });
  }

  async findByCategory(category: string) {
    return await this.repo.find({ where: { category }, order: { key: 'ASC' } });
  }

  async get(key: string): Promise<string> {
    const setting = await this.repo.findOne({ where: { key } });
    return setting?.value || '';
  }

  async set(key: string, value: string) {
    const setting = await this.repo.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      return await this.repo.save(setting);
    }
    return null;
  }

  async updateBulk(updates: { key: string; value: string }[]) {
    const results: AppSettings[] = [];
    for (const u of updates) {
      const r = await this.set(u.key, u.value);
      if (r) results.push(r);
    }
    return results;
  }
}
