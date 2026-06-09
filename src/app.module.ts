import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './libs/database/database.module';
import { LoggerMiddleware } from './libs/logger/logger.middleware';
import { ConfigModule } from './libs/config/config.module';
import { UserModule } from './modules/user/user.module';
import { PageModule } from './modules/page/page.module';
import { PostModule } from './modules/post/post.module';
import { FieldReportModule } from './modules/field-report/field-report.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ActionPlanModule } from './modules/action-plan/action-plan.module';
import { StrategicAlertModule } from './modules/strategic-alert/strategic-alert.module';
import { InteractionModule } from './modules/interaction/interaction.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { TwitterModule } from './modules/twitter/twitter.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { ClusterModule } from './modules/cluster/cluster.module';
// --- ساختار جدید ماژول‌های هدف (Requirement 1.6 — dual-import) ---
import { NetworksModule } from './networks/networks.module';
import { SourcesModule } from './sources/sources.module';
import { ContentModule } from './content/content.module';
import { ClustersModule } from './clusters/clusters.module';
import { CollectionModule } from './collection/collection.module';
import { OperationsModule } from './operations/operations.module';
import { AiModule } from './ai/ai.module';
import { PromptsModule } from './prompts/prompts.module';
import { AnalysisModule } from './analysis/analysis.module';
import { AnalyticsV2Module } from './analytics/analytics.module';
import { JobsModule } from './jobs/jobs.module';
import { AuthV2Module } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
// --- micromedia-transformation فاز ۱ — ماژول‌های محصول جدید ---
import { HubsModule } from './hubs/hubs.module';
import { MicroMediaModule } from './micro-media/micro-media.module';
import { MediaScoreModule } from './media-score/media-score.module';
import { TasksModule } from './tasks/tasks.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ManagementDashboardsModule } from './management-dashboards/management-dashboards.module';
import { AccessModule } from './access/access.module';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
// ساختار جدید common/ (دورهٔ گذار — Requirement 1.6): interceptor و filter سراسری
// از لایهٔ مشترک جدید استفاده می‌شوند تا Response Envelope یکدست تولید شود.
import { ResponseInterceptor } from './common/interceptors';
import { AllExceptionsFilter } from './common/filters';

@Module({
  imports: [
    // --- ساختار قدیمی modules/* (در دورهٔ گذار حفظ می‌شود — Requirement 1.6) ---
    AuthModule,
    DatabaseModule,
    ConfigModule,
    UserModule,
    PageModule,
    PostModule,
    FieldReportModule,
    AnalyticsModule,
    ActionPlanModule,
    StrategicAlertModule,
    InteractionModule,
    SettingsModule,
    TelegramModule,
    TwitterModule,
    TranscriptionModule,
    ClusterModule,
    // --- ساختار جدید ماژول‌های هدف (networks/, sources/, content/, ...) ---
    // اسکلت پوشه‌ها ایجاد شده و ماژول‌ها در فازهای بعدی یکی‌یکی منتقل و اینجا
    // به‌صورت dual-import اضافه می‌شوند تا هیچ قابلیتی از دست نرود.
    NetworksModule,
    SourcesModule,
    ContentModule,
    ClustersModule,
    CollectionModule,
    OperationsModule,
    // --- لایهٔ AI (مستقل از دامنه — Requirement 1.4 / design §3.2) ---
    // AiModule فراخوانی low-level OpenRouter را متمرکز می‌کند و تنها به
    // SettingsModule وابسته است. PromptsModule/AnalysisModule (فازهای بعدی)
    // این لایه را مصرف می‌کنند.
    AiModule,
    // PromptsModule — استودیوی Prompt با نسخه‌بندی (design §5.7، Requirement 6).
    // به AiModule (تست دستی) و AuthV2Module (محافظت admin-only) وابسته است و
    // PromptsService را برای AnalysisModule (تسک ۵.۸) صادر می‌کند.
    PromptsModule,
    // AnalysisModule — لایهٔ orchestration تحلیل (design §5.8، Requirement 7).
    // PromptsService (resolve نسخهٔ فعال) و AiService (اجرا) و ContentService/
    // NetworksService را مصرف می‌کند و AnalysisService را برای wire شدن به
    // delegation تک‌منبعی (تسک ۵.۱۱) و worker (تسک ۷.۶) صادر می‌کند.
    AnalysisModule,
    // AnalyticsV2Module — لایهٔ تجمیع فقط‌خواندنی داشبورد (design §5.9،
    // Requirement 8). فقط از جدول‌های summary روزانهٔ `*_daily_metrics` می‌خواند و
    // هیچ fetch/LLM و هیچ وابستگی به SourcesService ندارد (بدون circular dep).
    // کلاس عمداً `AnalyticsV2Module` نام دارد تا با `AnalyticsModule` legacy
    // (بالا) تداخل import نکند. `AnalyticsQueryService` صادر می‌شود تا تسک ۱۱.۵
    // بتواند `refreshSummaries` را از مسیر Job فراخواند.
    AnalyticsV2Module,
    // JobsModule — Job Center پایدار مبتنی بر Postgres (design §5.11، Requirement
    // 10). در تسک ۷.۲ لایهٔ سرویس + ماشین وضعیت + موجودیت‌ها را فراهم و
    // JobService را صادر می‌کند؛ JobWorker (تسک ۷.۴) و JobsController (تسک ۷.۶)
    // در ادامه به آن افزوده می‌شوند.
    JobsModule,
    // Platform / cross-cutting V2: احراز هویت (JWT + نقش‌ها)، کاربران داخلی و
    // ممیزی سبک (Requirement 11). به‌صورت dual-import در کنار AuthModule/UserModule
    // legacy ثبت می‌شوند؛ کنترلر جدید روی /auth/v2 است تا با /auth legacy تداخل نکند.
    UsersModule,
    AuthV2Module,
    AuditModule,
    // --- micromedia-transformation فاز ۱ — لایهٔ محصول مدیریت میکرورسانه ---
    // واحد مرکزی جدید MicroMedia + Hub + MediaScore + Tasks + Campaigns. کنار
    // ساختار موجود (افزایشی و غیرتخریبی) ثبت می‌شوند؛ مسیر کمپین‌ها `/campaigns`
    // (تداخل صفر با `/operations/*` legacy — تصمیم ۴).
    HubsModule,
    MediaScoreModule,
    MicroMediaModule,
    TasksModule,
    CampaignsModule,
    ManagementDashboardsModule,
    AccessModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // Response Envelope یکدست شاخهٔ موفق (Requirement 12.1, 12.3)
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      // envelope خطای یکدست با error.code نمادین (Requirement 12.2, 12.4)
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  constructor(private dataSource: DataSource) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
