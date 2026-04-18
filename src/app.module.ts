import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './libs/interceptors/response.interceptor';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor, // Use the response interceptor globally
    },
  ],
})
export class AppModule implements NestModule {
  constructor(private dataSource: DataSource) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
