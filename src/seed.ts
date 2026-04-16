import { DataSource } from 'typeorm';
import { Page } from './modules/page/page.entity';
import { Post } from './modules/post/post.entity';
import { FieldReport } from './modules/field-report/field-report.entity';
import { ActionPlan } from './modules/action-plan/action-plan.entity';
import { StrategicAlert } from './modules/strategic-alert/strategic-alert.entity';
import { User } from './modules/user/user.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: process.env.DB_PASSWORD || 'a1236987450',
  database: process.env.DB_NAME || 'social_monitor',
  entities: [Page, Post, FieldReport, ActionPlan, StrategicAlert, User],
  synchronize: true,
});

function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysBack));
  d.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  return;
  await dataSource.initialize();
  console.log('Connected to database');

  const userRepo = dataSource.getRepository(User);
  const pageRepo = dataSource.getRepository(Page);
  const postRepo = dataSource.getRepository(Post);
  const reportRepo = dataSource.getRepository(FieldReport);
  const actionRepo = dataSource.getRepository(ActionPlan);
  const alertRepo = dataSource.getRepository(StrategicAlert);

  // Clear existing data
  await alertRepo.delete({});
  await actionRepo.delete({});
  await reportRepo.delete({});
  await postRepo.delete({});
  await pageRepo.delete({});
  await userRepo.delete({});

  console.log('Cleared existing data');

  // --- Users ---
  const users = await userRepo.save([
    { name: 'علی محمدی', phone: '+989121234567' },
    { name: 'سارا احمدی', phone: '+989131234567' },
    { name: 'رضا حسینی', phone: '+989141234567' },
  ]);
  console.log(`Created ${users.length} users`);

  // --- 30 Pages ---
  const pagesData = [
    {
      name: 'خبرگزاری مقاومت',
      username: 'moqavemat_news',
      platform: 'instagram',
      category: 'news',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 850000,
      following_count: 320,
      bio: 'پوشش لحظه‌ای اخبار مقاومت در منطقه | تحلیل و گزارش',
      cluster: 'رسانه مقاومت',
      credibility_score: 8.5,
      influence_score: 9.2,
      consistency_rate: 8.8,
      persona_radar: { aggressive_defensive: 72, producer_resharer: 85, visual_textual: 60, formal_informal: 78, local_global: 35, interactive_oneway: 40 },
      pain_points: ['دیده شدن بین‌المللی', 'مقابله با سانسور', 'افزایش مخاطب غیرفارسی'],
      keywords: ['مقاومت', 'غزه', 'فلسطین', 'حزب‌الله', 'محور مقاومت'],
    },
    {
      name: 'تحلیل سیاسی خاورمیانه',
      username: 'mideast_analysis',
      platform: 'instagram',
      category: 'analyst',
      country: 'لبنان',
      language: 'عربی',
      followers_count: 420000,
      following_count: 180,
      bio: 'تحلیل‌های عمیق از تحولات خاورمیانه | دیدگاه بی‌طرف',
      cluster: 'تحلیل‌گران سیاسی',
      credibility_score: 7.8,
      influence_score: 7.5,
      consistency_rate: 6.9,
      persona_radar: { aggressive_defensive: 35, producer_resharer: 90, visual_textual: 30, formal_informal: 85, local_global: 20, interactive_oneway: 55 },
      pain_points: ['عدالت اجتماعی', 'صلح منطقه‌ای', 'حقوق بشر'],
      keywords: ['خاورمیانه', 'ژئوپلتیک', 'دیپلماسی', 'جنگ', 'صلح'],
    },
    {
      name: 'صبح سلماس',
      username: 'sobh_salmas',
      platform: 'instagram',
      category: 'local_news',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 35000,
      following_count: 890,
      bio: 'اخبار شهرستان سلماس و آذربایجان غربی',
      cluster: 'رسانه محلی',
      credibility_score: 5.2,
      influence_score: 3.8,
      consistency_rate: 4.1,
      persona_radar: { aggressive_defensive: 25, producer_resharer: 45, visual_textual: 70, formal_informal: 40, local_global: 95, interactive_oneway: 65 },
      pain_points: ['مشکلات زیرساختی', 'بیکاری', 'توجه مسئولین'],
      keywords: ['سلماس', 'آذربایجان غربی', 'محلی', 'شهرستان'],
    },
    {
      name: 'Sarah Hanson-Young',
      username: 'sarah_hanson_young',
      platform: 'twitter',
      category: 'politician',
      country: 'استرالیا',
      language: 'انگلیسی',
      followers_count: 310000,
      following_count: 2100,
      bio: 'Australian Greens Senator | Human rights advocate | Climate action',
      cluster: 'سیاستمداران بین‌المللی',
      credibility_score: 7.1,
      influence_score: 8.0,
      consistency_rate: 7.5,
      persona_radar: { aggressive_defensive: 55, producer_resharer: 75, visual_textual: 25, formal_informal: 45, local_global: 15, interactive_oneway: 70 },
      pain_points: ['حقوق بشر', 'تغییرات اقلیمی', 'حقوق پناهندگان'],
      keywords: ['human rights', 'Gaza', 'climate', 'refugees', 'justice'],
    },
    {
      name: 'ورامین‌دشت',
      username: 'varamin_dasht',
      platform: 'instagram',
      category: 'local_news',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 28000,
      following_count: 650,
      bio: 'صدای مردم ورامین | اخبار و رویدادهای محلی',
      cluster: 'رسانه محلی',
      credibility_score: 4.8,
      influence_score: 3.2,
      consistency_rate: 5.5,
      persona_radar: { aggressive_defensive: 30, producer_resharer: 55, visual_textual: 65, formal_informal: 35, local_global: 92, interactive_oneway: 72 },
      pain_points: ['آلودگی هوا', 'کمبود آب', 'ترافیک'],
      keywords: ['ورامین', 'تهران', 'محلی', 'کشاورزی'],
    },
    {
      name: 'Palestine Solidarity Campaign',
      username: 'paboroad',
      platform: 'twitter',
      category: 'activist',
      country: 'بریتانیا',
      language: 'انگلیسی',
      followers_count: 520000,
      following_count: 1200,
      bio: 'Campaigning for Palestinian rights and justice since 1982',
      cluster: 'فعالان حقوق فلسطین',
      credibility_score: 8.2,
      influence_score: 8.7,
      consistency_rate: 9.1,
      persona_radar: { aggressive_defensive: 68, producer_resharer: 70, visual_textual: 50, formal_informal: 60, local_global: 10, interactive_oneway: 55 },
      pain_points: ['اشغال فلسطین', 'حقوق بشر', 'تحریم اسرائیل'],
      keywords: ['Palestine', 'BDS', 'occupation', 'Gaza', 'human rights'],
    },
    {
      name: 'روایت فتح',
      username: 'revayat_fath',
      platform: 'instagram',
      category: 'documentary',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 195000,
      following_count: 410,
      bio: 'مستندسازی از دفاع مقدس و مقاومت | روایت‌های ناگفته',
      cluster: 'رسانه مقاومت',
      credibility_score: 7.9,
      influence_score: 6.8,
      consistency_rate: 8.2,
      persona_radar: { aggressive_defensive: 45, producer_resharer: 92, visual_textual: 85, formal_informal: 70, local_global: 50, interactive_oneway: 30 },
      pain_points: ['حفظ حافظه تاریخی', 'جذب نسل جوان', 'تولید محتوای باکیفیت'],
      keywords: ['دفاع مقدس', 'شهید', 'مستند', 'روایت', 'تاریخ'],
    },
    {
      name: 'Al Jazeera English',
      username: 'aljazeera',
      platform: 'twitter',
      category: 'news',
      country: 'قطر',
      language: 'انگلیسی',
      followers_count: 9800000,
      following_count: 3200,
      bio: 'Breaking news, features and analysis from Al Jazeera',
      cluster: 'رسانه بین‌المللی',
      credibility_score: 8.0,
      influence_score: 9.5,
      consistency_rate: 9.3,
      persona_radar: { aggressive_defensive: 40, producer_resharer: 95, visual_textual: 55, formal_informal: 90, local_global: 5, interactive_oneway: 35 },
      pain_points: ['بی‌طرفی', 'پوشش جامع', 'رقابت رسانه‌ای'],
      keywords: ['breaking news', 'Middle East', 'Gaza', 'world news', 'conflict'],
    },
    {
      name: 'نبض اقتصاد',
      username: 'nabz_eghtesad',
      platform: 'instagram',
      category: 'economy',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 380000,
      following_count: 290,
      bio: 'تحلیل اقتصادی | بازار سرمایه | ارز و طلا',
      cluster: 'رسانه اقتصادی',
      credibility_score: 6.5,
      influence_score: 7.0,
      consistency_rate: 7.8,
      persona_radar: { aggressive_defensive: 20, producer_resharer: 80, visual_textual: 40, formal_informal: 82, local_global: 60, interactive_oneway: 45 },
      pain_points: ['تورم', 'معیشت مردم', 'سیاست‌های اقتصادی'],
      keywords: ['اقتصاد', 'بورس', 'دلار', 'تورم', 'معیشت'],
    },
    {
      name: 'Electronic Intifada',
      username: 'intikiada',
      platform: 'twitter',
      category: 'activist',
      country: 'آمریکا',
      language: 'انگلیسی',
      followers_count: 680000,
      following_count: 890,
      bio: 'Independent online news publication focusing on Palestine',
      cluster: 'فعالان حقوق فلسطین',
      credibility_score: 7.6,
      influence_score: 8.1,
      consistency_rate: 8.5,
      persona_radar: { aggressive_defensive: 75, producer_resharer: 88, visual_textual: 35, formal_informal: 65, local_global: 8, interactive_oneway: 50 },
      pain_points: ['آزادی بیان', 'سانسور رسانه‌ای', 'حقوق فلسطینیان'],
      keywords: ['Palestine', 'intifada', 'occupation', 'apartheid', 'resistance'],
    },
    {
      name: 'لایف‌استایل مدرن',
      username: 'modern_lifestyle_ir',
      platform: 'instagram',
      category: 'lifestyle',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 920000,
      following_count: 450,
      bio: 'سبک زندگی | مد | سفر | غذا',
      cluster: 'لایف‌استایل',
      credibility_score: 4.2,
      influence_score: 6.5,
      consistency_rate: 7.0,
      persona_radar: { aggressive_defensive: 10, producer_resharer: 60, visual_textual: 90, formal_informal: 20, local_global: 55, interactive_oneway: 80 },
      pain_points: ['دیده شدن', 'درآمدزایی', 'همکاری برندها'],
      keywords: ['لایف‌استایل', 'مد', 'سفر', 'غذا', 'زیبایی'],
    },
    {
      name: 'مجمع جهانی اهل‌بیت',
      username: 'ahlulbayt_world',
      platform: 'instagram',
      category: 'religious',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 145000,
      following_count: 320,
      bio: 'ترویج فرهنگ اهل‌بیت (ع) در سطح جهان',
      cluster: 'رسانه مذهبی',
      credibility_score: 6.8,
      influence_score: 5.5,
      consistency_rate: 8.0,
      persona_radar: { aggressive_defensive: 15, producer_resharer: 70, visual_textual: 55, formal_informal: 88, local_global: 25, interactive_oneway: 25 },
      pain_points: ['اسلام‌هراسی', 'تبلیغ صحیح', 'جذب نسل جوان'],
      keywords: ['اهل‌بیت', 'اسلام', 'تشیع', 'فرهنگ', 'معنویت'],
    },
    {
      name: 'Mondoweiss',
      username: 'mondoweiss',
      platform: 'twitter',
      category: 'news',
      country: 'آمریکا',
      language: 'انگلیسی',
      followers_count: 290000,
      following_count: 1500,
      bio: 'Independent website devoted to informing readers about Palestine/Israel',
      cluster: 'فعالان حقوق فلسطین',
      credibility_score: 7.3,
      influence_score: 7.0,
      consistency_rate: 7.8,
      persona_radar: { aggressive_defensive: 60, producer_resharer: 85, visual_textual: 30, formal_informal: 75, local_global: 12, interactive_oneway: 45 },
      pain_points: ['آزادی مطبوعات', 'روایت فلسطینی', 'عدالت'],
      keywords: ['Palestine', 'Israel', 'journalism', 'occupation', 'justice'],
    },
    {
      name: 'هنر انقلاب',
      username: 'honar_enghelab',
      platform: 'instagram',
      category: 'art',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 78000,
      following_count: 560,
      bio: 'هنر متعهد | پوستر | گرافیک | نقاشی دیواری',
      cluster: 'هنر و فرهنگ',
      credibility_score: 6.0,
      influence_score: 5.2,
      consistency_rate: 6.5,
      persona_radar: { aggressive_defensive: 50, producer_resharer: 95, visual_textual: 95, formal_informal: 30, local_global: 40, interactive_oneway: 60 },
      pain_points: ['حمایت مالی', 'دیده شدن', 'آزادی بیان هنری'],
      keywords: ['هنر', 'پوستر', 'گرافیک', 'انقلاب', 'فرهنگ'],
    },
    {
      name: 'Press TV',
      username: 'presstv',
      platform: 'twitter',
      category: 'news',
      country: 'ایران',
      language: 'انگلیسی',
      followers_count: 1200000,
      following_count: 890,
      bio: 'Iran\'s English-language news network',
      cluster: 'رسانه بین‌المللی',
      credibility_score: 6.2,
      influence_score: 7.8,
      consistency_rate: 8.5,
      persona_radar: { aggressive_defensive: 65, producer_resharer: 90, visual_textual: 50, formal_informal: 85, local_global: 10, interactive_oneway: 30 },
      pain_points: ['سانسور پلتفرم‌ها', 'اعتبار بین‌المللی', 'رقابت رسانه‌ای'],
      keywords: ['Iran', 'Middle East', 'resistance', 'news', 'geopolitics'],
    },
    {
      name: 'دانشجوی آزاد',
      username: 'daneshjoo_azad',
      platform: 'telegram',
      category: 'student',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 52000,
      following_count: 120,
      bio: 'صدای دانشجویان | حقوق دانشجویی | فعالیت‌های فرهنگی',
      cluster: 'جنبش دانشجویی',
      credibility_score: 5.5,
      influence_score: 4.8,
      consistency_rate: 5.0,
      persona_radar: { aggressive_defensive: 60, producer_resharer: 65, visual_textual: 40, formal_informal: 30, local_global: 70, interactive_oneway: 75 },
      pain_points: ['آزادی بیان', 'اشتغال', 'کیفیت آموزش'],
      keywords: ['دانشجو', 'دانشگاه', 'آموزش', 'حقوق', 'جوانان'],
    },
    {
      name: 'Middle East Eye',
      username: 'middleeasteye',
      platform: 'twitter',
      category: 'news',
      country: 'بریتانیا',
      language: 'انگلیسی',
      followers_count: 2100000,
      following_count: 2800,
      bio: 'Award-winning journalism from the Middle East and North Africa',
      cluster: 'رسانه بین‌المللی',
      credibility_score: 7.9,
      influence_score: 8.8,
      consistency_rate: 8.9,
      persona_radar: { aggressive_defensive: 42, producer_resharer: 92, visual_textual: 50, formal_informal: 88, local_global: 8, interactive_oneway: 40 },
      pain_points: ['بی‌طرفی', 'دسترسی به منابع', 'امنیت خبرنگاران'],
      keywords: ['Middle East', 'MENA', 'Gaza', 'conflict', 'journalism'],
    },
    {
      name: 'سلامت و تندرستی',
      username: 'salamat_ir',
      platform: 'instagram',
      category: 'health',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 650000,
      following_count: 380,
      bio: 'اطلاعات پزشکی معتبر | سلامت روان | تغذیه',
      cluster: 'لایف‌استایل',
      credibility_score: 6.8,
      influence_score: 5.9,
      consistency_rate: 7.2,
      persona_radar: { aggressive_defensive: 8, producer_resharer: 75, visual_textual: 70, formal_informal: 65, local_global: 60, interactive_oneway: 70 },
      pain_points: ['اطلاعات نادرست پزشکی', 'سلامت روان', 'دسترسی به دارو'],
      keywords: ['سلامت', 'پزشکی', 'تغذیه', 'روانشناسی', 'ورزش'],
    },
    {
      name: 'Gaza Now',
      username: 'gazanow',
      platform: 'telegram',
      category: 'news',
      country: 'فلسطین',
      language: 'عربی',
      followers_count: 3500000,
      following_count: 50,
      bio: 'أخبار غزة لحظة بلحظة | Gaza news in real-time',
      cluster: 'رسانه مقاومت',
      credibility_score: 7.5,
      influence_score: 9.0,
      consistency_rate: 9.5,
      persona_radar: { aggressive_defensive: 80, producer_resharer: 70, visual_textual: 75, formal_informal: 50, local_global: 15, interactive_oneway: 20 },
      pain_points: ['بقا', 'رساندن صدا', 'مستندسازی جنایات'],
      keywords: ['غزه', 'فلسطین', 'جنگ', 'شهدا', 'مقاومت'],
    },
    {
      name: 'تکنولوژی فردا',
      username: 'tech_farda',
      platform: 'instagram',
      category: 'technology',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 280000,
      following_count: 520,
      bio: 'آخرین اخبار تکنولوژی | بررسی گجت | هوش مصنوعی',
      cluster: 'تکنولوژی',
      credibility_score: 5.8,
      influence_score: 5.5,
      consistency_rate: 6.8,
      persona_radar: { aggressive_defensive: 15, producer_resharer: 70, visual_textual: 65, formal_informal: 55, local_global: 40, interactive_oneway: 65 },
      pain_points: ['تحریم‌ها', 'دسترسی به تکنولوژی', 'فیلترینگ'],
      keywords: ['تکنولوژی', 'هوش مصنوعی', 'گوشی', 'اپلیکیشن', 'استارتاپ'],
    },
    {
      name: 'Quds News Network',
      username: 'qaborads',
      platform: 'twitter',
      category: 'news',
      country: 'فلسطین',
      language: 'انگلیسی',
      followers_count: 1800000,
      following_count: 650,
      bio: 'Palestinian media network covering Palestine and the region',
      cluster: 'رسانه مقاومت',
      credibility_score: 7.2,
      influence_score: 8.3,
      consistency_rate: 8.7,
      persona_radar: { aggressive_defensive: 70, producer_resharer: 80, visual_textual: 60, formal_informal: 65, local_global: 10, interactive_oneway: 35 },
      pain_points: ['سانسور', 'امنیت خبرنگاران', 'پوشش جنگ'],
      keywords: ['Quds', 'Palestine', 'Gaza', 'resistance', 'occupation'],
    },
    {
      name: 'ورزش سه',
      username: 'varzesh3_official',
      platform: 'instagram',
      category: 'sports',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 4200000,
      following_count: 180,
      bio: 'بزرگ‌ترین رسانه ورزشی ایران',
      cluster: 'لایف‌استایل',
      credibility_score: 6.0,
      influence_score: 7.5,
      consistency_rate: 9.0,
      persona_radar: { aggressive_defensive: 20, producer_resharer: 65, visual_textual: 75, formal_informal: 35, local_global: 45, interactive_oneway: 80 },
      pain_points: ['سرعت خبررسانی', 'رقابت', 'حقوق پخش'],
      keywords: ['فوتبال', 'ورزش', 'لیگ برتر', 'تیم ملی', 'المپیک'],
    },
    {
      name: 'Roger Waters',
      username: 'rogerwaters',
      platform: 'instagram',
      category: 'celebrity',
      country: 'بریتانیا',
      language: 'انگلیسی',
      followers_count: 1500000,
      following_count: 120,
      bio: 'Musician, activist, co-founder of Pink Floyd',
      cluster: 'سلبریتی‌های حامی',
      credibility_score: 7.0,
      influence_score: 8.5,
      consistency_rate: 6.0,
      persona_radar: { aggressive_defensive: 78, producer_resharer: 60, visual_textual: 70, formal_informal: 25, local_global: 5, interactive_oneway: 30 },
      pain_points: ['عدالت جهانی', 'فلسطین', 'ضد جنگ'],
      keywords: ['Palestine', 'BDS', 'peace', 'music', 'activism'],
    },
    {
      name: 'اقتصاد آنلاین',
      username: 'eghtesadonline',
      platform: 'instagram',
      category: 'economy',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 510000,
      following_count: 340,
      bio: 'تحلیل بازارها | اخبار اقتصادی | بورس و ارز',
      cluster: 'رسانه اقتصادی',
      credibility_score: 7.0,
      influence_score: 6.8,
      consistency_rate: 8.2,
      persona_radar: { aggressive_defensive: 18, producer_resharer: 82, visual_textual: 45, formal_informal: 80, local_global: 55, interactive_oneway: 40 },
      pain_points: ['تورم', 'رکود', 'سیاست‌گذاری اقتصادی'],
      keywords: ['بورس', 'دلار', 'اقتصاد', 'بانک مرکزی', 'تورم'],
    },
    {
      name: 'Bella Hadid',
      username: 'bellahadid',
      platform: 'instagram',
      category: 'celebrity',
      country: 'آمریکا',
      language: 'انگلیسی',
      followers_count: 61000000,
      following_count: 800,
      bio: 'Model | Palestinian-American',
      cluster: 'سلبریتی‌های حامی',
      credibility_score: 5.5,
      influence_score: 9.8,
      consistency_rate: 3.5,
      persona_radar: { aggressive_defensive: 45, producer_resharer: 40, visual_textual: 95, formal_informal: 15, local_global: 5, interactive_oneway: 20 },
      pain_points: ['هویت فلسطینی', 'فشار رسانه‌ای', 'آزادی بیان'],
      keywords: ['Palestine', 'fashion', 'model', 'identity', 'freedom'],
    },
    {
      name: 'خبرآنلاین',
      username: 'khabaronline_ir',
      platform: 'instagram',
      category: 'news',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 2800000,
      following_count: 250,
      bio: 'خبرگزاری آنلاین | پوشش ۲۴ ساعته اخبار ایران و جهان',
      cluster: 'رسانه داخلی',
      credibility_score: 6.5,
      influence_score: 7.8,
      consistency_rate: 8.8,
      persona_radar: { aggressive_defensive: 30, producer_resharer: 85, visual_textual: 50, formal_informal: 82, local_global: 40, interactive_oneway: 35 },
      pain_points: ['سرعت خبررسانی', 'اعتبار', 'رقابت دیجیتال'],
      keywords: ['ایران', 'سیاست', 'اقتصاد', 'اجتماعی', 'فرهنگ'],
    },
    {
      name: 'Yemen Updates',
      username: 'yemen_updates',
      platform: 'telegram',
      category: 'news',
      country: 'یمن',
      language: 'عربی',
      followers_count: 180000,
      following_count: 90,
      bio: 'تغطية شاملة للأحداث في اليمن',
      cluster: 'رسانه مقاومت',
      credibility_score: 6.0,
      influence_score: 5.8,
      consistency_rate: 7.0,
      persona_radar: { aggressive_defensive: 72, producer_resharer: 60, visual_textual: 55, formal_informal: 60, local_global: 30, interactive_oneway: 25 },
      pain_points: ['جنگ', 'بحران انسانی', 'محاصره'],
      keywords: ['یمن', 'انصارالله', 'جنگ', 'محاصره', 'مقاومت'],
    },
    {
      name: 'فرهنگ و اندیشه',
      username: 'farhang_andishe',
      platform: 'instagram',
      category: 'culture',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 95000,
      following_count: 680,
      bio: 'کتاب | فلسفه | هنر | نقد فرهنگی',
      cluster: 'هنر و فرهنگ',
      credibility_score: 7.2,
      influence_score: 4.5,
      consistency_rate: 6.8,
      persona_radar: { aggressive_defensive: 20, producer_resharer: 88, visual_textual: 30, formal_informal: 90, local_global: 50, interactive_oneway: 55 },
      pain_points: ['سطحی‌نگری', 'کتاب‌خوانی', 'نقد سازنده'],
      keywords: ['کتاب', 'فلسفه', 'هنر', 'فرهنگ', 'اندیشه'],
    },
    {
      name: 'Resistance News Network',
      username: 'raborads',
      platform: 'telegram',
      category: 'news',
      country: 'فلسطین',
      language: 'انگلیسی',
      followers_count: 750000,
      following_count: 30,
      bio: 'Covering the Palestinian resistance in real-time',
      cluster: 'رسانه مقاومت',
      credibility_score: 6.8,
      influence_score: 8.0,
      consistency_rate: 9.2,
      persona_radar: { aggressive_defensive: 85, producer_resharer: 65, visual_textual: 60, formal_informal: 55, local_global: 10, interactive_oneway: 15 },
      pain_points: ['سانسور', 'امنیت', 'پوشش لحظه‌ای'],
      keywords: ['resistance', 'Palestine', 'Gaza', 'operation', 'breaking'],
    },
    {
      name: 'غیرفعال - پیج حذف‌شده',
      username: 'deleted_page_01',
      platform: 'instagram',
      category: 'unknown',
      country: 'ایران',
      language: 'فارسی',
      followers_count: 12000,
      following_count: 200,
      bio: '',
      cluster: 'نامشخص',
      credibility_score: 1.0,
      influence_score: 0.5,
      consistency_rate: 0.3,
      is_active: false,
      persona_radar: { aggressive_defensive: 50, producer_resharer: 10, visual_textual: 50, formal_informal: 50, local_global: 50, interactive_oneway: 50 },
      pain_points: [],
      keywords: [],
    },
  ];

  const pages = await pageRepo.save(pagesData.map((p) => pageRepo.create(p)));
  console.log(`Created ${pages.length} pages`);

  // --- Posts (5-8 posts per page) ---
  const sentimentLabels = ['angry', 'hopeful', 'neutral', 'sad'];
  const postTypes = ['image', 'video', 'reel', 'story', 'carousel'];
  const topicPool = [
    'غزه', 'فلسطین', 'اقتصاد', 'تورم', 'انتخابات آمریکا', 'حقوق بشر',
    'تغییرات اقلیمی', 'هوش مصنوعی', 'بحران انسانی', 'تحریم', 'دیپلماسی',
    'جنگ', 'صلح', 'مقاومت', 'رسانه', 'فرهنگ', 'ورزش', 'سلامت',
    'آموزش', 'محیط زیست', 'انرژی', 'نفت', 'بورس', 'مسکن',
  ];
  const keywordPool = [
    'غزه', 'فلسطین', 'مقاومت', 'حماس', 'اسرائیل', 'جنگ', 'صلح',
    'شهید', 'بمباران', 'آوارگان', 'سازمان ملل', 'حقوق بشر', 'تحریم',
    'اقتصاد', 'دلار', 'تورم', 'بورس', 'نفت', 'طلا', 'مسکن',
    'انتخابات', 'ترامپ', 'بایدن', 'ایران', 'عراق', 'لبنان', 'یمن',
    'هوش مصنوعی', 'تکنولوژی', 'استارتاپ', 'اینترنت', 'فیلترینگ',
  ];

  const captionTemplates = [
    'گزارش تصویری از آخرین تحولات {topic} | تحلیل کارشناسی وضعیت فعلی و چشم‌انداز آینده',
    'بررسی عمیق موضوع {topic}: چرا این مسئله اهمیت دارد و چه تاثیری بر منطقه خواهد گذاشت؟',
    '🔴 فوری | آخرین اخبار مربوط به {topic} — جزئیات در ادامه',
    'تحلیل هفتگی: وضعیت {topic} در هفته گذشته و پیش‌بینی هفته آینده',
    'نگاهی به ابعاد پنهان {topic} که رسانه‌های اصلی به آن نمی‌پردازند',
    'مستند کوتاه: روایت مردم عادی از {topic} | صداهایی که شنیده نمی‌شوند',
    'اینفوگرافیک: آمار و ارقام کلیدی درباره {topic} در سال جاری',
    'گفتگوی اختصاصی با کارشناس {topic}: «وضعیت بحرانی‌تر از آن چیزی است که فکر می‌کنید»',
    'واکنش‌های بین‌المللی به تحولات اخیر {topic} — مرور دیدگاه‌ها',
    'پشت صحنه: چگونه {topic} زندگی میلیون‌ها نفر را تحت تاثیر قرار داده است',
  ];

  const allPosts: any[] = [];
  for (const page of pages) {
    const postCount = randomInt(5, 8);
    const pageTopics = page.keywords?.slice(0, 3) || [pick(topicPool)];

    for (let i = 0; i < postCount; i++) {
      const topic = pick(pageTopics);
      const caption = pick(captionTemplates).replace('{topic}', topic);
      const sentimentScore = randomFloat(-1, 1);
      const sentimentLabel = sentimentScore > 0.3 ? 'hopeful' : sentimentScore < -0.3 ? 'angry' : sentimentScore < -0.1 ? 'sad' : 'neutral';
      const isReshare = Math.random() < 0.25;

      allPosts.push(postRepo.create({
        page_id: page.id,
        external_id: `ext_${page.id}_${i}_${Date.now()}`,
        caption,
        post_type: pick(postTypes),
        likes_count: randomInt(50, page.followers_count * 0.05),
        comments_count: randomInt(5, page.followers_count * 0.005),
        shares_count: randomInt(0, page.followers_count * 0.002),
        views_count: randomInt(500, page.followers_count * 0.1),
        sentiment_score: sentimentScore,
        sentiment_label: sentimentLabel,
        extracted_keywords: [pick(keywordPool), pick(keywordPool), pick(keywordPool)].filter((v, idx, a) => a.indexOf(v) === idx),
        extracted_topics: [pick(topicPool), pick(topicPool)].filter((v, idx, a) => a.indexOf(v) === idx),
        is_reshare: isReshare,
        original_source: isReshare ? pick(pages.filter((p) => p.id !== page.id))?.username || undefined : undefined,
        published_at: randomDate(30),
      }));
    }
  }

  const savedPosts = await postRepo.save(allPosts);
  console.log(`Created ${savedPosts.length} posts`);

  // --- Field Reports ---
  const fieldReportsData = [
    { page_id: pages[2].id, reporter_id: users[0].id, content: 'پیج صبح سلماس در حالی که آتش‌سوزی بزرگی در منطقه رخ داده، مشغول انتشار پست تبلیغاتی است. مردم در کامنت‌ها به شدت اعتراض کرده‌اند و تعداد آنفالوها افزایش یافته.', source_type: 'voice', extracted_keywords: ['آتش‌سوزی', 'تبلیغات', 'اعتراض', 'آنفالو'], sentiment: 'angry', status: 'processed' },
    { page_id: pages[4].id, reporter_id: users[1].id, content: 'ادمین پیج ورامین‌دشت اخیراً تغییر کرده و لحن محتوا از انتقادی به تبلیغاتی تغییر یافته. احتمال فروش پیج وجود دارد.', source_type: 'manual', extracted_keywords: ['تغییر ادمین', 'فروش پیج', 'تغییر لحن'], sentiment: 'neutral', status: 'processed' },
    { page_id: pages[0].id, reporter_id: users[0].id, content: 'خبرگزاری مقاومت در پوشش عملیات اخیر غزه عملکرد بسیار خوبی داشت. سرعت انتشار خبر از الجزیره هم بالاتر بود.', source_type: 'voice', extracted_keywords: ['عملکرد خوب', 'سرعت', 'غزه', 'پوشش خبری'], sentiment: 'hopeful', status: 'processed' },
    { page_id: pages[10].id, reporter_id: users[2].id, content: 'پیج لایف‌استایل مدرن اخیراً یک پست درباره غزه منتشر کرد که بازخورد بسیار بالایی گرفت. این نشان‌دهنده نفوذ محتوای سیاسی در لایه‌های خاکستری است.', source_type: 'manual', extracted_keywords: ['لایف‌استایل', 'غزه', 'نفوذ', 'لایه خاکستری'], sentiment: 'hopeful', status: 'processed' },
    { page_id: pages[15].id, reporter_id: users[0].id, content: 'کانال دانشجوی آزاد در تلگرام فعالیتش به شدت کاهش یافته. احتمال فشار امنیتی یا خستگی ادمین وجود دارد.', source_type: 'voice', extracted_keywords: ['کاهش فعالیت', 'فشار', 'خستگی'], sentiment: 'sad', status: 'pending' },
    { page_id: pages[7].id, reporter_id: users[1].id, content: 'الجزیره انگلیسی در پوشش اخبار غزه بسیار فعال بوده ولی در موضوع یمن سکوت کرده. این شکاف محتوایی قابل توجه است.', source_type: 'manual', extracted_keywords: ['الجزیره', 'غزه', 'یمن', 'سکوت', 'شکاف'], sentiment: 'neutral', status: 'processed' },
    { page_id: pages[3].id, reporter_id: users[2].id, content: 'سناتور سارا هانسون اخیراً در مجلس استرالیا درباره غزه صحبت کرد. واکنش‌ها در شبکه‌های اجتماعی بسیار مثبت بود. فرصت خوبی برای تعامل.', source_type: 'file', extracted_keywords: ['سناتور', 'استرالیا', 'غزه', 'فرصت تعامل'], sentiment: 'hopeful', status: 'processed' },
    { page_id: pages[29].id, reporter_id: users[0].id, content: 'این پیج کاملاً غیرفعال شده و محتوای قبلی هم در حال حذف شدن است. احتمال مسدود شدن یا تغییر کاربری.', source_type: 'manual', extracted_keywords: ['غیرفعال', 'حذف محتوا', 'مسدود'], sentiment: 'sad', status: 'processed', is_override: true, override_note: 'تحلیل‌گر ارشد: این پیج به احتمال زیاد توسط پلتفرم مسدود شده و نیاز به جایگزین دارد.' },
    { page_id: pages[18].id, reporter_id: users[1].id, content: 'غزه ناو در ۲۴ ساعت گذشته بیش از ۵۰ خبر فوری منتشر کرده. سرعت واکنش فوق‌العاده بالاست ولی دقت برخی اخبار زیر سوال رفته.', source_type: 'voice', extracted_keywords: ['غزه ناو', 'سرعت', 'دقت', 'خبر فوری'], sentiment: 'neutral', status: 'processed' },
    { page_id: pages[22].id, reporter_id: users[2].id, content: 'راجر واترز در کنسرت اخیرش پرچم فلسطین را بالا برد. ویدیوی این لحظه بیش از ۱۰ میلیون بازدید گرفته. فرصت بازنشر.', source_type: 'manual', extracted_keywords: ['راجر واترز', 'کنسرت', 'فلسطین', 'ویدیو وایرال'], sentiment: 'hopeful', status: 'processed' },
  ];

  const savedReports = await reportRepo.save(fieldReportsData.map((r) => reportRepo.create(r)));
  console.log(`Created ${savedReports.length} field reports`);

  // --- Action Plans ---
  const actionPlansData = [
    { page_id: pages[2].id, title: 'توقف فوری تبلیغات', description: 'با توجه به آتش‌سوزی در منطقه، تمام پست‌های تبلیغاتی باید متوقف شود و پست همدردی منتشر شود.', status: 'todo', priority: 3, category: 'publish_post', suggested_tone: 'empathetic', is_ai_generated: true },
    { page_id: pages[2].id, title: 'پاسخ به کامنت‌های منفی', description: 'کامنت‌های اعتراضی مردم درباره بی‌توجهی به آتش‌سوزی باید با لحن همدلانه پاسخ داده شود.', status: 'in_progress', priority: 2, category: 'reply_comments', suggested_tone: 'empathetic' },
    { page_id: pages[0].id, title: 'انتشار تحلیل هفتگی غزه', description: 'تحلیل جامع از وضعیت غزه در هفته گذشته با اینفوگرافیک.', status: 'todo', priority: 1, category: 'publish_post', suggested_content: 'اینفوگرافیک آمار تلفات و خسارات هفته گذشته', is_ai_generated: true },
    { page_id: pages[3].id, title: 'ارسال ریلز کودکان غزه', description: 'ویدیوی کوتاه با تمرکز بر کودکان غزه برای سناتور هانسون ارسال شود. لحن همدلانه و غیررسمی.', status: 'todo', priority: 2, category: 'engage_audience', suggested_tone: 'empathetic', suggested_content: 'ریلز ۳۰ ثانیه‌ای با زیرنویس انگلیسی', is_ai_generated: true },
    { page_id: pages[10].id, title: 'تکرار محتوای سیاسی', description: 'با توجه به بازخورد بالای پست غزه، ۲ پست دیگر با زاویه انسانی منتشر شود.', status: 'todo', priority: 1, category: 'content_strategy', is_ai_generated: true },
    { page_id: pages[15].id, title: 'بررسی وضعیت ادمین', description: 'تماس با ادمین کانال دانشجوی آزاد برای بررسی دلیل کاهش فعالیت.', status: 'todo', priority: 2, category: 'other', assigned_to: 'علی محمدی' },
    { page_id: pages[7].id, title: 'پوشش اخبار یمن', description: 'شکاف محتوایی الجزیره در موضوع یمن شناسایی شده. پیشنهاد ارسال محتوا از منابع یمنی.', status: 'done', priority: 1, category: 'content_strategy', is_ai_generated: true },
    { page_id: pages[22].id, title: 'بازنشر ویدیوی کنسرت', description: 'ویدیوی راجر واترز با پرچم فلسطین باید در تمام پیج‌های شبکه بازنشر شود.', status: 'in_progress', priority: 3, category: 'publish_post', suggested_content: 'ویدیو + کپشن فارسی و انگلیسی' },
  ];

  const savedActions = await actionRepo.save(actionPlansData.map((a) => actionRepo.create(a)));
  console.log(`Created ${savedActions.length} action plans`);

  // --- Strategic Alerts ---
  const alertsData = [
    { title: 'شکاف محتوایی: اقتصاد غزه', message: 'موضوع «اقتصاد غزه» در سطح بین‌الملل داغ شده اما از ۳۰ پیج شبکه، فقط ۲ پیج به آن پرداخته‌اند. تمرکز فوری روی ابعاد اقتصادی جنگ برای ۴۸ ساعت آینده.', priority: 'critical', category: 'silence_gap', target_pages: [pages[0].id, pages[1].id, pages[7].id, pages[8].id], status: 'active', created_by: users[0].id, group_key: 'silence_gap', assigned_to: 'علی محمدی', impact_radius: 45, involved_pages_count: 4, evidence_url: 'https://example.com/evidence/1', playbook: ['تولید فوری محتوا درباره اقتصاد غزه', 'بازنشر محتوای مرتبط از منابع معتبر', 'هماهنگی با تیم محتوا برای پوشش ۲۴ ساعته'] },
    { title: 'فرصت: واکنش سناتور استرالیایی', message: 'سارا هانسون در مجلس استرالیا از فلسطین حمایت کرد. فرصت طلایی برای تعامل و ارسال محتوا. تیم تعامل بین‌الملل فعال شود.', priority: 'high', category: 'opportunity', target_pages: [pages[3].id], status: 'active', created_by: users[1].id, group_key: 'opportunity', impact_radius: 12, involved_pages_count: 1, playbook: ['بهره‌برداری فوری از فرصت', 'ارسال ریلز کودکان غزه به سناتور', 'هماهنگی با پیج‌های بین‌المللی'] },
    { title: 'بحران: آتش‌سوزی سلماس', message: 'آتش‌سوزی بزرگ در سلماس رخ داده و پیج محلی در حال انتشار تبلیغات است. واکنش فوری لازم است. دستور توقف تبلیغات صادر شود.', priority: 'critical', category: 'crisis', target_pages: [pages[2].id], status: 'investigating', created_by: users[0].id, group_key: 'crisis', assigned_to: 'سارا احمدی', impact_radius: 8, involved_pages_count: 1, playbook: ['توقف فوری انتشار تبلیغات', 'تماس با ادمین پیج', 'انتشار پست همدردی با مردم'] },
    { title: 'تغییر ترند: نفوذ در لایه خاکستری', message: 'پیج لایف‌استایل مدرن با انتشار محتوای سیاسی بازخورد بالایی گرفت. این الگو قابل تکرار در سایر پیج‌های لایف‌استایل است.', priority: 'medium', category: 'trend_shift', target_pages: [pages[10].id], status: 'active', created_by: users[2].id, group_key: 'trend_shift', impact_radius: 22, involved_pages_count: 1, playbook: ['تحلیل عمیق دلایل تغییر ترند', 'شناسایی پیج‌های مشابه برای تکرار الگو', 'تنظیم استراتژی محتوا'] },
    { title: 'هشدار: کاهش فعالیت کانال دانشجویی', message: 'کانال دانشجوی آزاد فعالیتش به شدت کاهش یافته. بررسی فوری وضعیت ادمین و در صورت نیاز فعال‌سازی جایگزین.', priority: 'high', category: 'crisis', target_pages: [pages[15].id], status: 'needs_response', created_by: users[0].id, group_key: 'crisis', impact_radius: 5, involved_pages_count: 1, playbook: ['تماس با ادمین کانال', 'بررسی دلایل کاهش فعالیت', 'آماده‌سازی جایگزین در صورت نیاز'] },
    { title: 'موج شایعه اقتصادی', message: 'شایعه افزایش قیمت ارز در ۱۵ پیج اقتصادی و خبری منتشر شده. نیاز به هماهنگی برای کنترل روایت.', priority: 'high', category: 'trend_shift', target_pages: [pages[8].id, pages[23].id, pages[25].id], status: 'active', created_by: users[1].id, group_key: 'trend_shift', impact_radius: 35, involved_pages_count: 3, playbook: ['انتشار محتوای تحلیلی آرام‌بخش', 'هماهنگی با پیج‌های اقتصادی', 'رصد واکنش‌ها در ۶ ساعت آینده'] },
  ];

  const savedAlerts = await alertRepo.save(alertsData.map((a) => alertRepo.create(a)));
  console.log(`Created ${savedAlerts.length} strategic alerts`);

  console.log('\n✅ Seed completed successfully!');
  console.log(`Summary: ${users.length} users, ${pages.length} pages, ${savedPosts.length} posts, ${savedReports.length} field reports, ${savedActions.length} action plans, ${savedAlerts.length} alerts`);

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
