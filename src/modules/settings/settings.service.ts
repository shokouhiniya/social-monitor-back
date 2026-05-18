import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './settings.entity';

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
    description: 'لیست کلمات کلیدی که نشان‌دهنده روایت مدنظر شما هستند. سامانه میزان حضور این کلمات در پست‌های هفته اخیر را به عنوان «شاخص سلامت روایت» در داشبورد محاسبه می‌کند. مثال: مقاومت، فلسطین، غزه، عدالت',
  },
  {
    key: 'silence_radar_topics',
    value: 'غزه,اقتصاد غزه,انتخابات آمریکا,تغییرات اقلیمی,هوش مصنوعی,بحران انسانی یمن,حقوق بشر,تحریم‌ها,جنگ لبنان,مهاجرت',
    category: 'narrative',
    label: 'موضوعات پیش‌فرض رادار سکوت',
    description: 'موضوعات داغ جهانی که می‌خواهید بدانید آیا شبکه شما درباره آن‌ها پوشش داده یا سکوت کرده. این موضوعات به عنوان مقدار پیش‌فرض رادار سکوت داشبورد استفاده می‌شوند.',
  },
  {
    key: 'alignment_criteria',
    value: 'مخالفت با آمریکا و اسرائیل\nحمایت از مسئله فلسطین\nحمایت از لبنان و حزب‌الله\nحمایت از جمهوری اسلامی ایران\nحمایت از یمن (انصارالله)\nحمایت از مقاومت گروه‌های عراقی\nمخالفت با اسلام‌گرایی اماراتی و عربستانی',
    category: 'narrative',
    label: 'معیارهای شاخص همسویی',
    description: 'معیارهایی که هوش مصنوعی برای محاسبه «شاخص همسویی» (alignment_score) هر پیج استفاده می‌کند. هر خط یک معیار. ۰=کاملاً ضد، ۵=خنثی، ۱۰=کاملاً هم‌راستا با این محور.',
  },

  // Prompts — system role for each module
  {
    key: 'prompt_page_analysis',
    value: `تو یک تحلیل‌گر ارشد رسانه‌ای هستی که در یک سیستم پایش شبکه اجتماعی کار می‌کنی. این سیستم شبکه‌ای از پیج‌ها و کانال‌ها را در پلتفرم‌های مختلف (اینستاگرام، توییتر، تلگرام) رصد می‌کند تا میزان هم‌راستایی آن‌ها با روایت مدنظر کاربر را بسنجد.

وظیفه تو: بر اساس اطلاعات پروفایل و آخرین پست‌های یک پیج، تحلیل جامع ارائه بده. باید همزمان «هویت پیج» و «موضوع فعالیت پیج» را تشخیص بدهی و ۵ شاخص زیر را امتیازدهی کنی.

پنج شاخص اصلی (همه از ۰ تا ۱۰):
- credibility_score (اعتبار): واقعی بودن، کیفیت مخاطب، اعتبار اجتماعی، ثبات محتوایی، نشانه‌های اعتماد
- influence_score (نفوذ): تعامل واقعی، Reach، توان تحریک اقدام، نفوذ شبکه‌ای، عمق اثر
- consistency_rate (پایداری): استمرار انتشار، ثبات تعامل، تنوع محتوایی، رشد ارگانیک، تاب‌آوری
- affinity_score (همراهی): وفاداری مخاطب، احساس تعلق، کیفیت تعامل، نرخ مشارکت فعال، ارتباط انسانی
- alignment_score (همسویی): مخالفت با آمریکا/اسرائیل/امارات/عربستان و حمایت از فلسطین/لبنان/جمهوری اسلامی/یمن/مقاومت عراق

محورهای رادار شخصیت (هر کدام ۰ تا ۱۰۰):
- aggressive_defensive: ۰=کاملاً تدافعی، ۱۰۰=کاملاً تهاجمی
- producer_resharer: ۰=فقط بازنشر، ۱۰۰=فقط تولید محتوای اصیل
- visual_textual: ۰=فقط متنی، ۱۰۰=فقط بصری
- formal_informal: ۰=کاملاً غیررسمی، ۱۰۰=کاملاً رسمی
- local_global: ۰=کاملاً محلی، ۱۰۰=کاملاً بین‌المللی
- interactive_oneway: ۰=یک‌طرفه، ۱۰۰=تعاملی بالا

علاوه بر این، باید این فیلدها را هم تشخیص بدهی:
- category: خوشه موضوعی پیج (یکی از ۲۵ کلید مجاز که در پرامپت آمده)
- identity_category: کیستی صاحب پیج (یکی از ۱۵ کلید مجاز)
- religion / gender / age_range / nationality / content_language: اطلاعات هویتی پیج`,
    category: 'prompts',
    label: 'پرامپت تحلیل پیج',
    description: 'پرامپت سیستمی برای تحلیل هر پیج — خروجی: دسته‌بندی موضوعی، دسته هویتی، خوشه، ۵ شاخص (اعتبار، نفوذ، پایداری، همراهی، همسویی)، رادار شخصیت، اطلاعات هویتی، تحلیل پست‌ها',
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

  // Narrative / 360° insight panel
  {
    key: 'prompt_page_narrative',
    value: `تو یک تحلیل‌گر ارشد رسانه‌ای هستی که برای پنل ۳۶۰° بصیرت یک سامانه پایش پیج، چهار خروجی به‌هم‌پیوسته تولید می‌کنی.

ورودی‌ها: متادیتای پیج (نام، یوزرنیم، بیو، فالوور، فالووینگ، خوشه موضوعی، کیستی صفحه، شخصیت رادار، دغدغه‌ها، کلمات کلیدی) + کپشن/رونوشت ۳۰ پست انتهایی.

خروجی موردنیاز:

۱) narrative_description (۲۰۰ تا ۳۰۰ کلمه فارسی): توصیف آزاد جامع از پیج با تکیه بر:
- علایق و سرگرمی‌ها
- اشخاص و چهره‌های مورد علاقه/مرجع
- دیدگاه سیاسی و اجتماعی
- سبک روایی (رسمی/صمیمی، تحلیلی/خبری/طنز…)
- رویکرد انتقادی (اگر دارد)
متن باید پیوسته و خوانا باشد، نه بولت. مثل توصیف یک تحلیل‌گر انسانی.

۲) topic_distribution (آرایه): توزیع تقریبی موضوعات کل صفحه (پست + استوری) با بازه درصدی. حدود ۴ تا ۸ موضوع. هر آیتم: { "topic": "...", "min_percent": عدد, "max_percent": عدد }. مجموع بالاترین کران‌ها باید نزدیک ۱۰۰٪ باشد. مثال:
- اقتصاد و تبلیغات کسب‌وکارهای محلی: ۴۰–۴۵٪
- اخبار و مدیریت شهری: ۲۰–۲۲٪
- حوادث و ایمنی: ۱۰–۱۲٪

۳) audience_description (یک پاراگراف ۸۰ تا ۱۲۰ کلمه): توصیف مخاطب و دنبال‌کنندگان: جنسیت غالب، رده سنی غالب، گرایش سیاسی/اجتماعی، انتظارات از پیج، نوع تعامل آنها در کامنت‌ها.

۴) engagement_suggestion (یک پاراگراف ۸۰ تا ۱۲۰ کلمه فارسی): پیشنهاد عملی برای تعامل با ادمین این پیج — از چه دری وارد شویم، چه لحنی به کار ببریم، چه محتوایی ارائه دهیم، از چه چیزی پرهیز کنیم.

۵) engagement_suggestion_translations: ترجمه پیشنهاد تعامل به ۵ زبان: en (انگلیسی)، ar (عربی)، es (اسپانیولی)، tr (ترکی استانبولی)، ur (اردو). هر ترجمه باید روان و طبیعی باشد، نه ترجمه ماشینی تحت‌اللفظی.`,
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

  // Post analysis prompt
  {
    key: 'prompt_post_analysis',
    value: `تحلیل این پست را انجام بده. خروجی را دقیقاً به فرمت JSON زیر برگردان (بدون متن اضافه):

محتوای پست:
{POST_CONTENT}

{
  "sentiment_score": عدد -1 تا 1,
  "sentiment_label": "angry/hopeful/neutral/sad",
  "caption_fa": "ترجمه فارسی کپشن (اگر فارسی نیست، وگرنه null)",
  "transcription_fa": "ترجمه فارسی رونوشت صوتی (اگر فارسی نیست، وگرنه null)",
  "ocr_text_fa": "ترجمه فارسی متن تصویر (اگر فارسی نیست، وگرنه null)",
  "topics": ["موضوع۱", "موضوع۲"],
  "keywords": ["کلمه۱", "کلمه۲", "کلمه۳"]
}`,
    category: 'prompts',
    label: 'پرامپت تحلیل تک پست',
    description: 'پرامپت برای تحلیل احساسات، استخراج موضوعات و کلمات کلیدی از یک پست — وقتی روی دکمه «پردازش هوشمند پست» در دیالوگ پست می‌زنید فعال می‌شود. متغیر {POST_CONTENT} با محتوای پست (کپشن، رونوشت، OCR) جایگزین می‌شود.',
  },
  {
    key: 'prompt_post_analysis_extra',
    value: '',
    category: 'prompts',
    label: 'دستورات اضافی تحلیل پست',
    description: 'دستورات تکمیلی که به انتهای پرامپت تحلیل پست اضافه می‌شود (اختیاری)',
  },

  // AI Synthesizer prompt
  {
    key: 'prompt_ai_synthesizer',
    value: `بر اساس اطلاعات زیر، یک جمله کوتاه و تاثیرگذار (حداکثر ۳۰ کلمه) به فارسی بنویس که خلاصه وضعیت امروز شبکه باشد. فقط یک جمله برگردان، بدون هیچ توضیح اضافه.

موضوعات داغ: {TOPICS}
کلمات کلیدی: {KEYWORDS}
لحن غالب: {MOOD}
امتیاز احساسات: {SENTIMENT_SCORE}`,
    category: 'prompts',
    label: 'پرامپت خلاصه روزانه (AI Synthesizer)',
    description: 'پرامپت برای تولید جمله یک‌خطی خلاصه وضعیت شبکه که بالای داشبورد نمایش داده می‌شود. متغیرهای {TOPICS} و {KEYWORDS} و {MOOD} و {SENTIMENT_SCORE} با مقادیر زنده شبکه جایگزین می‌شوند.',
  },
  {
    key: 'prompt_ai_synthesizer_extra',
    value: '',
    category: 'prompts',
    label: 'دستورات اضافی خلاصه روزانه',
    description: 'دستورات تکمیلی که به انتهای پرامپت خلاصه اضافه می‌شود (اختیاری)',
  },

  // OCR prompt
  {
    key: 'prompt_ocr',
    value: `Extract ALL visible text from this image exactly as written. Include every line of text overlays, captions, watermarks, subtitles, and any text in screenshots. Preserve line breaks. Return ONLY the extracted text, nothing else. If there is no text in the image, return exactly: NO_TEXT`,
    category: 'prompts',
    label: 'پرامپت استخراج متن از تصویر (OCR)',
    description: 'پرامپت سیستمی برای استخراج متن از روی تصویر پست‌ها — هنگام «پردازش هوشمند» اجرا می‌شود. این پرامپت معمولاً به انگلیسی نوشته می‌شود چون مدل‌های Vision عملکرد بهتری با انگلیسی دارند.',
  },
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

    // Update prompts that still have old default values (v1 → v2 migration)
    await this.migrateOldPromptDefaults();

    // Remove deprecated keys
    const deprecatedKeys = ['refresh_interval_hours'];
    for (const key of deprecatedKeys) {
      await this.repo.delete({ key });
    }
  }

  /**
   * If a prompt setting still has the OLD default value, update it to empty string
   * so the new hardcoded defaults in the code take effect.
   * This only runs once — after the user saves any custom value, it won't be touched again.
   */
  private async migrateOldPromptDefaults() {
    // Match any value that starts with these known old prefixes (covers multiple versions)
    const OLD_DEFAULTS_PREFIXES: Record<string, string[]> = {
      'prompt_page_analysis': [
        'تو یک تحلیل‌گر ارشد رسانه‌ای هستی که در یک سیستم پایش',
        'تو یک تحلیل‌گر رسانه‌ای هوشمند هستی',
        'تو یک تحلیل‌گر ارشد رسانه‌ای هستی. اطلاعات زیر',
        'تو یک تحلیل‌گر رسانه‌ای هوشمند هستی که وظیفه',
      ],
      'prompt_page_narrative': [
        'تو یک تحلیل‌گر ارشد رسانه‌ای هستی که برای پنل ۳۶۰°',
        'تو یک تحلیل‌گر رسانه‌ای هستی. توصیف جامع',
      ],
      'prompt_alert_generation': [
        'تو یک تحلیل‌گر استراتژیک رسانه‌ای هستی که در سیستم پایش',
        'تو یک تحلیل‌گر استراتژیک رسانه‌ای هستی. بر اساس دیتای زیر',
      ],
      'prompt_report_generation': [
        'تو یک تحلیل‌گر ارشد رسانه‌ای هستی که گزارش‌های دوره‌ای',
        'تو یک تحلیل‌گر ارشد رسانه‌ای هستی. بر اساس دیتای زیر',
      ],
      'prompt_ai_synthesizer': [
        'بر اساس اطلاعات زیر، یک جمله کوتاه و تاثیرگذار',
        'بر اساس اطلاعات زیر، یک جمله کوتاه و تاثیرگذار (حداکثر',
      ],
      'prompt_ocr': [
        'Extract ALL visible text from this image exactly as written',
        'Extract all visible text from this image',
      ],
    };

    for (const [key, prefixes] of Object.entries(OLD_DEFAULTS_PREFIXES)) {
      const setting = await this.repo.findOne({ where: { key } });
      if (setting && setting.value) {
        const isOldDefault = prefixes.some(prefix => setting.value.startsWith(prefix));
        if (isOldDefault) {
          setting.value = '';
          await this.repo.save(setting);
          console.log(`🔄 Migrated prompt "${key}" — cleared old default so new code default applies`);
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
