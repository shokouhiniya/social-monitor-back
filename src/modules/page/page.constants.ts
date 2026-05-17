/**
 * Topical clusters (موضوع فعالیت) — 25 categories
 * The page's primary content theme.
 */
export const TOPICAL_CLUSTERS = {
  technology: {
    label: 'تکنولوژی و دیجیتال',
    description: 'بررسی گجت‌ها، معرفی نرم‌افزارها، هوش مصنوعی و اخبار دنیای فناوری',
  },
  marketing: {
    label: 'بازاریابی و تولید محتوا',
    description: 'آموزش استراتژی‌های فروش، رشد در شبکه‌های اجتماعی و مهارت‌های تبلیغات',
  },
  science: {
    label: 'علم و دانستنی‌ها',
    description: 'ساده‌سازی مفاهیم علمی، نجوم، عجایب خلقت و اطلاعات عمومی مستند',
  },
  quran: {
    label: 'قرآن و معارف دینی',
    description: 'تمرکز تخصصی بر تلاوت، تفسیر، آموزش تجوید و مفاهیم قرآنی',
  },
  eulogy: {
    label: 'مداحی و مراسمات',
    description: 'پوشش محتوای هیئات، نوحه‌خوانی، مناجات و مناسبت‌های مذهبی شیعی',
  },
  mysticism: {
    label: 'عرفان و معنویت',
    description: 'مباحث اخلاقی، خودشناسی، ذن، فلسفه زندگی و ارتباطات درونی',
  },
  parenting: {
    label: 'والدگری و تربیت',
    description: 'آموزش‌های مربوط به رشد کودک، روانشناسی فرزندپروری و تعاملات خانوادگی',
  },
  beauty: {
    label: 'آرایشی و سلامت',
    description: 'معرفی محصولات زیبایی، روتین‌های پوستی، میکاپ و بهداشت فردی',
  },
  fashion: {
    label: 'مد، پوشاک و حجاب',
    description: 'نمایش استایل، ترندهای لباس، طراحی دوخت و پوشش‌های اسلامی',
  },
  art: {
    label: 'هنر',
    description: 'تحلیل و نمایش آثار در حوزه‌های تجسمی، سینما، تئاتر و ادبیات',
  },
  music: {
    label: 'موسیقی و پادکست',
    description: 'انتشار قطعات موسیقی، تحلیل آواز، معرفی آلبوم‌ها و محتواهای صوتی',
  },
  photography: {
    label: 'عکاسی و تصویربرداری',
    description: 'آموزش تکنیک‌های ثبت عکس، تدوین ویدیو و معرفی تجهیزات بصری',
  },
  anime_games: {
    label: 'انیمه، گیم و کارتون',
    description: 'نقد و بررسی بازی‌های ویدئویی، دنیای انیمه و فرهنگ پاپ مرتبط',
  },
  news_politics: {
    label: 'اخبار و تحلیل سیاسی',
    description: 'بازنشر وقایع روز ایران و جهان و ارائه تفسیرهای سیاسی',
  },
  environment: {
    label: 'محیط زیست و حیات وحش',
    description: 'ترویج پایداری، حفاظت از طبیعت و نمایش مستندهای جانوری',
  },
  comedy: {
    label: 'طنز و سرگرمی',
    description: 'تولید محتوای خنده‌دار، دوربین مخفی، چالش‌های فان و لحظات مفرح',
  },
  dance: {
    label: 'رقص و پرفورمنس',
    description: 'نمایش حرکات موزون، طراحی رقص و اجراهای بدنی هنری',
  },
  travel: {
    label: 'سفر و ایرانگردی',
    description: 'معرفی مقاصد توریستی، راهنمای سفر و اشتراک تجربه‌های جهانگردی',
  },
  history: {
    label: 'تاریخ و باستان‌شناسی',
    description: 'روایت وقایع گذشته، معرفی تمدن‌ها و بررسی بناهای تاریخی',
  },
  sports: {
    label: 'ورزش و فوتبال',
    description: 'اخبار تیم‌ها، تحلیل مسابقات، نتایج زنده و حواشی دنیای ورزش',
  },
  cooking: {
    label: 'آشپزی و فودبلاگری',
    description: 'آموزش پخت غذا، تست رستوران‌ها و معرفی فرهنگ‌های غذایی',
  },
  military: {
    label: 'نظامی و امنیتی',
    description: 'بررسی تسلیحات، تحلیل‌های استراتژیک دفاعی و اخبار قوای مسلح',
  },
  business_crypto: {
    label: 'کسب‌وکار و ارز دیجیتال',
    description: 'تحلیل بازارهای مالی، آموزش ترید، بورس و مدیریت مالی',
  },
  social_legal: {
    label: 'مسائل اجتماعی و حقوقی',
    description: 'بررسی معضلات جامعه، آموزش‌های قانونی و حقوق شهروندی',
  },
  medicine: {
    label: 'پزشکی و سلامت',
    description: 'اطلاعات مربوط به بیماری‌ها، درمان‌های کلینیکی و توصیه‌های سلامت جسمی',
  },
} as const;

export type TopicalClusterKey = keyof typeof TOPICAL_CLUSTERS;

/**
 * Identity categories (کیستی صاحب صفحه) — 15 categories
 * Who owns / runs the page.
 */
export const IDENTITY_CATEGORIES = {
  journalist: {
    label: 'ژورنالیست و خبرنگار',
    description: 'فردی که حرفه‌اش جمع‌آوری، تایید و انتشار اخبار با نگاه حرفه‌ای است',
  },
  lifestyle_blogger: {
    label: 'بلاگر لایف‌استایل',
    description: 'شخصی که محوریت صفحه‌اش نمایش جزئیات زندگی شخصی و سبک روزمرگی اوست',
  },
  influencer: {
    label: 'اینفلوئنسر و چهره مجازی',
    description: 'کسی که قدرت اثرگذاری و شهرتش را صرفاً از بستر رسانه‌های اجتماعی کسب کرده است',
  },
  comedian: {
    label: 'واینر و طنزپرداز',
    description: 'کمدینی که در قالب کلیپ‌های کوتاه (Skit) تولید محتوای سرگرم‌کننده می‌کند',
  },
  cleric: {
    label: 'روحانی و مبلغ',
    description: 'فرد تحصیل‌کرده علوم دینی که به تبیین شریعت و هدایت مذهبی می‌پردازد',
  },
  eulogist: {
    label: 'مداح و ذاکر',
    description: 'هنرمند مذهبی که از طریق صوت و لحن به ذکر مصیبت یا مدح پیشوایان دینی می‌پردازد',
  },
  academic: {
    label: 'استاد دانشگاه و پژوهشگر',
    description: 'فرد دارای مدارج آکادمیک که محتوای علمی و تحلیلی تخصصی ارائه می‌دهد',
  },
  civic_activist: {
    label: 'فعال مدنی و سیاسی',
    description: 'شخصی که داوطلبانه برای تغییرات اجتماعی، سیاسی یا محیط‌زیستی تلاش و مطالبه‌گری می‌کند',
  },
  artist_singer: {
    label: 'هنرمند و خواننده',
    description: 'فردی که خارج از فضای مجازی در یکی از شاخه‌های هنری به صورت حرفه‌ای شناخته شده است',
  },
  kid_parent_blogger: {
    label: 'کودک‌بلاگر و والد‌بلاگر',
    description: 'صفحاتی که محوریت آن‌ها نمایش مستقیم زیست کودک یا تجربیات والدین است',
  },
  hijab_blogger: {
    label: 'حجاب‌بلاگر',
    description: 'اینفلوئنسری که تمرکز اصلی‌اش ترویج و نمایش استایل‌های پوشش اسلامی و چادر است',
  },
  expert: {
    label: 'متخصص و کارشناس',
    description: 'فردی که صاحب فن یا مهارتی (مثل وکالت یا طبابت) است و دانشش را عرضه می‌کند',
  },
  corporate: {
    label: 'رسانه شرکتی و سازمانی',
    description: 'صفحه‌ای که هویت یک برند، نهاد یا ارگان دولتی/خصوصی را نمایندگی می‌کند',
  },
  athlete: {
    label: 'ورزشکار',
    description: 'قهرمانان ملی یا حرفه‌ای که صفحه شخصی‌شان را برای ارتباط با هواداران دارند',
  },
  tourist: {
    label: 'توریست و گردشگر',
    description: 'صفحه‌ای که ضمن بازدید از مکان‌های مختلف به انتشار محتوا می‌پردازد',
  },
} as const;

export type IdentityCategoryKey = keyof typeof IDENTITY_CATEGORIES;

/**
 * Standardised gender values.
 */
export const GENDERS = {
  male: 'مرد',
  female: 'زن',
  mixed: 'مختلط (تیمی)',
  unknown: 'نامشخص',
} as const;

/**
 * Standardised age ranges.
 */
export const AGE_RANGES = {
  under_18: 'زیر ۱۸',
  '18_25': '۱۸ تا ۲۵',
  '25_35': '۲۵ تا ۳۵',
  '35_50': '۳۵ تا ۵۰',
  over_50: 'بالای ۵۰',
  unknown: 'نامشخص',
} as const;

/**
 * Standardised religion values.
 */
export const RELIGIONS = {
  shia: 'شیعه',
  sunni: 'سنی',
  christian: 'مسیحی',
  jewish: 'یهودی',
  bahai: 'بهائی',
  zoroastrian: 'زرتشتی',
  none: 'بی‌دین',
  other: 'سایر',
  unknown: 'نامشخص',
} as const;

/**
 * Build a lookup map from key → label.
 */
export const TOPICAL_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(TOPICAL_CLUSTERS).map(([k, v]) => [k, v.label]),
);

export const IDENTITY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(IDENTITY_CATEGORIES).map(([k, v]) => [k, v.label]),
);
