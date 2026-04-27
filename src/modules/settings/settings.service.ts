import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './settings.entity';

const DEFAULT_SETTINGS = [
  // Tokens
  { key: 'openrouter_key', value: '', category: 'tokens', label: 'OpenRouter API Key', description: 'کلید API برای هوش مصنوعی — اگر خالی باشد از .env خوانده می‌شود' },
  { key: 'llm_model', value: 'google/gemini-2.5-pro', category: 'tokens', label: 'مدل LLM', description: 'مدل هوش مصنوعی مورد استفاده' },

  // Narrative
  { key: 'target_narrative', value: 'مقاومت,فلسطین,غزه,حقوق بشر,عدالت', category: 'narrative', label: 'روایت مدنظر', description: 'کلمات کلیدی روایت هدف (با کاما جدا کنید)' },
  { key: 'silence_radar_topics', value: 'غزه,اقتصاد غزه,انتخابات آمریکا,تغییرات اقلیمی,هوش مصنوعی,بحران انسانی یمن,حقوق بشر,تحریم‌ها,جنگ لبنان,مهاجرت', category: 'narrative', label: 'موضوعات رادار سکوت', description: 'موضوعات داغ جهانی برای مقایسه با شبکه' },

  // Prompts — system role for each module
  {
    key: 'prompt_page_analysis',
    value: `تو یک تحلیل‌گر ارشد رسانه‌ای هستی که در یک سیستم پایش شبکه اجتماعی کار می‌کنی. این سیستم شبکه‌ای از پیج‌ها و کانال‌ها را در پلتفرم‌های مختلف (اینستاگرام، توییتر، تلگرام) رصد می‌کند تا میزان هم‌راستایی آن‌ها با روایت مدنظر کاربر را بسنجد.

وظیفه تو: بر اساس اطلاعات پروفایل و آخرین پست‌های یک پیج، تحلیل جامع ارائه بده.

معیارهای امتیازدهی:
- credibility_score (اعتبار): بر اساس کیفیت محتوا، صحت اطلاعات، و حرفه‌ای بودن. ۰=اسپم/جعلی، ۱۰=منبع معتبر و مرجع
- influence_score (نفوذ): بر اساس نسبت تعامل به فالوور، بازنشر توسط دیگران، و تاثیرگذاری بر گفتمان. ۰=بدون تاثیر، ۱۰=تاثیرگذار کلیدی
- consistency_rate (پایداری): بر اساس نظم انتشار، ثبات موضوعی، و فعالیت مداوم. ۰=غیرفعال/بی‌نظم، ۱۰=بسیار منظم و فعال

محورهای رادار شخصیت (هر کدام ۰ تا ۱۰۰):
- aggressive_defensive: ۰=کاملاً تدافعی، ۱۰۰=کاملاً تهاجمی
- producer_resharer: ۰=فقط بازنشر، ۱۰۰=فقط تولید محتوای اصیل
- visual_textual: ۰=فقط متنی، ۱۰۰=فقط بصری
- formal_informal: ۰=کاملاً غیررسمی، ۱۰۰=کاملاً رسمی
- local_global: ۰=کاملاً محلی، ۱۰۰=کاملاً بین‌المللی
- interactive_oneway: ۰=یک‌طرفه، ۱۰۰=تعاملی بالا`,
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
    value: `تو یک تحلیل‌گر ارشد رسانه‌ای هستی که گزارش‌های دوره‌ای برای مدیر یک شبکه پایش رسانه‌ای تولید می‌کنی. این شبکه شامل پیج‌ها و کانال‌هایی در اینستاگرام، توییتر و تلگرام است که برای پیشبرد یک روایت مشخص فعالیت می‌کنند.

هدف گزارش: ارائه تصویر کلی از وضعیت شبکه در بازه زمانی مشخص‌شده، شناسایی نقاط قوت و ضعف، و ارائه پیشنهادات عملیاتی قابل اجرا.

ساختار گزارش مورد انتظار:
- headline: یک تیتر کوتاه و تاثیرگذار که وضعیت کلی شبکه را خلاصه کند
- report: گزارش مفصل شامل: ۱) وضعیت کلی فعالیت شبکه ۲) موضوعات داغ و ترندها ۳) تحلیل لحن و احساسات غالب ۴) عملکرد پیج‌های کلیدی ۵) پیشنهادات عملیاتی مشخص برای بهبود عملکرد شبکه
- mood: حال‌وهوای غالب (امیدوار/ملتهب/در وضعیت انتظار)
- top_topics: ۳ موضوع برتر
- top_keywords: ۳ کلمه کلیدی برتر

نکته: پیشنهادات عملیاتی باید مشخص و قابل اجرا باشند (مثلاً: «پیج X باید محتوای بیشتری درباره Y تولید کند» نه «محتوای بهتر تولید شود»).`,
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
    value: `تو یک تحلیل‌گر استراتژیک رسانه‌ای هستی که در سیستم پایش یک شبکه اجتماعی هدفمند کار می‌کنی. وظیفه تو شناسایی تهدیدها، فرصت‌ها و نقاط بحرانی در عملکرد شبکه است.

انواع هشدار:
- silence_gap (شکاف سکوت): موضوع مهمی که شبکه درباره آن سکوت کرده یا پوشش نداده
- trend_shift (تغییر ترند): تغییر ناگهانی در موضوعات، لحن، یا الگوی فعالیت شبکه
- crisis (بحران): پیج‌های غیرفعال، ریزش مخاطب، یا انتشار محتوای مخرب
- opportunity (فرصت): ترند جدید قابل بهره‌برداری، پیج مستعد رشد، یا فضای مناسب برای تزریق روایت

معیارهای اولویت‌بندی:
- critical: نیاز به اقدام فوری (مثلاً بحران شهرت یا سکوت در موضوع حساس)
- high: نیاز به اقدام در ۲۴ ساعت
- medium: نیاز به بررسی در هفته جاری
- low: قابل برنامه‌ریزی

برای هر هشدار، playbook باید شامل اقدامات مشخص و قابل اجرا باشد (چه کسی، چه کاری، در چه زمانی).

دقیقاً ۵ هشدار تولید کن — حداقل یکی از هر دسته.`,
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
  { key: 'refresh_interval_hours', value: '6', category: 'general', label: 'فاصله بروزرسانی (ساعت)', description: 'فاصله زمانی پیش‌فرض برای گزارش دوره‌ای' },
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
