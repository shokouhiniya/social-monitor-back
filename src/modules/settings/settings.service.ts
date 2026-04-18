import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './settings.entity';

const DEFAULT_SETTINGS = [
  // Tokens
  { key: 'rapidapi_key', value: '', category: 'tokens', label: 'RapidAPI Key', description: 'کلید API برای واکشی اطلاعات اینستاگرام' },
  { key: 'openrouter_key', value: '', category: 'tokens', label: 'OpenRouter API Key', description: 'کلید API برای هوش مصنوعی (Gemini)' },
  { key: 'llm_model', value: 'google/gemini-2.5-pro', category: 'tokens', label: 'مدل LLM', description: 'مدل هوش مصنوعی مورد استفاده' },

  // Narrative
  { key: 'target_narrative', value: 'مقاومت,فلسطین,غزه,حقوق بشر,عدالت', category: 'narrative', label: 'روایت مدنظر', description: 'کلمات کلیدی روایت هدف (با کاما جدا کنید)' },
  { key: 'silence_radar_topics', value: 'غزه,اقتصاد غزه,انتخابات آمریکا,تغییرات اقلیمی,هوش مصنوعی,بحران انسانی یمن,حقوق بشر,تحریم‌ها,جنگ لبنان,مهاجرت', category: 'narrative', label: 'موضوعات رادار سکوت', description: 'موضوعات داغ جهانی برای مقایسه با شبکه' },

  // Prompts — system role for each module
  {
    key: 'prompt_page_analysis',
    value: `تو یک تحلیل‌گر رسانه‌ای هوشمند هستی که وظیفه تحلیل عمیق پیج‌های اینستاگرامی را داری.
هدف: بر اساس اطلاعات پروفایل و آخرین پست‌های یک پیج، تحلیل جامع ارائه بده.
خروجی‌های مورد انتظار:
- category: دسته‌بندی پیج (news/activist/celebrity/lifestyle/economy و ...)
- cluster: خوشه معنایی (مثلاً رسانه مقاومت، لایف‌استایل)
- credibility_score: امتیاز اعتبار (۰ تا ۱۰)
- influence_score: امتیاز نفوذ (۰ تا ۱۰)
- consistency_rate: نرخ پایداری محتوا (۰ تا ۱۰)
- persona_radar: نمودار رادار شخصیت (۶ محور از ۰ تا ۱۰۰)
- pain_points: دغدغه‌های اصلی پیج
- keywords: کلمات کلیدی محتوا
- posts_analysis: تحلیل احساسات و موضوعات هر پست`,
    category: 'prompts',
    label: 'پرامپت تحلیل پیج',
    description: 'پرامپت سیستمی برای تحلیل هر پیج — خروجی: دسته‌بندی، خوشه، امتیازات، رادار شخصیت، دغدغه‌ها، کلمات کلیدی، تحلیل پست‌ها',
  },
  {
    key: 'prompt_page_analysis_extra',
    value: '',
    category: 'prompts',
    label: 'دستورات اضافی تحلیل پیج',
    description: 'دستورات تکمیلی که به انتهای پرامپت تحلیل پیج اضافه می‌شود (اختیاری)',
  },
  {
    key: 'prompt_report_generation',
    value: `تو یک تحلیل‌گر ارشد رسانه‌ای هستی که وظیفه تولید گزارش‌های تحلیلی دوره‌ای را داری.
هدف: بر اساس داده‌های کل شبکه (پیج‌ها، موضوعات داغ، کلمات کلیدی، احساسات)، یک گزارش جامع بنویس.
خروجی‌های مورد انتظار:
- headline: تیتر یک خطی وضعیت شبکه
- report: گزارش مفصل (حداقل ۵ پاراگراف: وضعیت کلی، موضوعات داغ، تحلیل احساسات، نقاط قوت/ضعف، پیشنهادات عملیاتی)
- mood: حال‌وهوای شبکه (امیدوار/ملتهب/در وضعیت انتظار)
- top_topics: موضوعات برتر
- top_keywords: کلمات کلیدی برتر`,
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
    key: 'prompt_alert_generation',
    value: `تو یک تحلیل‌گر استراتژیک رسانه‌ای هستی که وظیفه شناسایی تهدیدها و فرصت‌ها را داری.
هدف: بر اساس داده‌های شبکه، ۵ هشدار استراتژیک تولید کن.
خروجی‌های مورد انتظار (برای هر هشدار):
- title: عنوان هشدار
- message: توضیح مفصل (حداقل ۲ جمله)
- priority: اولویت (critical/high/medium/low)
- category: دسته (silence_gap/trend_shift/crisis/opportunity)
- playbook: لیست اقدامات پیشنهادی (حداقل ۳ مورد)`,
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

  // General
  { key: 'refresh_interval_hours', value: '6', category: 'general', label: 'فاصله بروزرسانی (ساعت)', description: 'فاصله زمانی بین بروزرسانی‌های خودکار' },
  { key: 'max_posts_per_fetch', value: '12', category: 'general', label: 'حداکثر پست در هر واکشی', description: 'تعداد پست‌هایی که در هر بارگیری واکشی می‌شوند' },
  { key: 'cooldown_minutes', value: '15', category: 'general', label: 'زمان انتظار بروزرسانی (دقیقه)', description: 'حداقل فاصله بین دو بروزرسانی دستی' },
];

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(AppSettings)
    private repo: Repository<AppSettings>,
  ) {}

  async onModuleInit() {
    // Seed default settings if not exist
    for (const s of DEFAULT_SETTINGS) {
      const existing = await this.repo.findOne({ where: { key: s.key } });
      if (!existing) {
        await this.repo.save(this.repo.create(s));
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
