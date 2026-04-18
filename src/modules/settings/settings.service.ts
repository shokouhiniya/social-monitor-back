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

  // Prompts
  { key: 'prompt_page_analysis', value: 'تو یک تحلیل‌گر رسانه‌ای هوشمند هستی. اطلاعات پیج اینستاگرامی را تحلیل کن.', category: 'prompts', label: 'پرامپت تحلیل پیج', description: 'پرامپت سیستمی برای تحلیل هر پیج' },
  { key: 'prompt_report_generation', value: 'تو یک تحلیل‌گر ارشد رسانه‌ای هستی. گزارش تحلیلی جامع بنویس.', category: 'prompts', label: 'پرامپت تولید گزارش', description: 'پرامپت سیستمی برای تولید گزارش دوره‌ای' },
  { key: 'prompt_alert_generation', value: 'تو یک تحلیل‌گر استراتژیک رسانه‌ای هستی. هشدارهای استراتژیک تولید کن.', category: 'prompts', label: 'پرامپت تولید هشدار', description: 'پرامپت سیستمی برای تولید هشدارها' },

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
