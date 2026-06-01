import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StrategicAlert } from '../modules/strategic-alert/strategic-alert.entity';
import { ActionPlan } from '../modules/action-plan/action-plan.entity';
import { Interaction } from '../modules/interaction/interaction.entity';
import { FieldReport } from '../modules/field-report/field-report.entity';
import { AlertsController } from './strategic-alerts/strategic-alerts.controller';
import { AlertsService } from './strategic-alerts/strategic-alerts.service';
import { ActionPlansController } from './action-plans/action-plans.controller';
import { ActionPlansService } from './action-plans/action-plans.service';
import { InteractionsController } from './interactions/interactions.controller';
import { InteractionsService } from './interactions/interactions.service';
import { FieldReportsController } from './field-reports/field-reports.controller';
import { FieldReportsService } from './field-reports/field-reports.service';

/**
 * OperationsModule — جریان‌های عملیاتی با workflow وضعیت (design §5.10).
 *
 * چهار زیرماژول را گرد هم می‌آورد: `strategic-alerts`, `action-plans`,
 * `interactions`, `field-reports`. هر زیرماژول `list` (صفحه‌بندی‌شده،
 * Requirement 9.5) و `create` (با وضعیت اولیهٔ معتبر، Requirement 9.4) دارد؛
 * `strategic-alerts` و `action-plans` علاوه بر این `transition` با ماشین وضعیت
 * صریح دارند (Requirement 9.1-9.3).
 *
 * **بازکاربری entity (الگوی Source = Page / ContentItem = Post — تسک ۳.۴/۳.۷):**
 * موجودیت‌های موجود `StrategicAlert`, `ActionPlan`, `Interaction`, `FieldReport`
 * دوباره استفاده می‌شوند (هیچ `@Entity` دومی روی همان جدول‌ها تعریف نمی‌شود تا
 * تعارض metadata در TypeORM رخ ندهد).
 *
 * **بدون migration:** هر چهار جدول از قبل ستون‌های لازم را دارند —
 * `strategic_alerts.status` (پیش‌فرض `active`) و `action_plans.status` (پیش‌فرض
 * `todo`) برای ماشین وضعیت کافی‌اند؛ `field_reports.status` (پیش‌فرض `pending`)
 * نیز موجود است و `interactions` گذار وضعیت ندارد. بنابراین این تسک هیچ
 * migration ای اضافه نمی‌کند.
 *
 * **غیرتخریبی (Requirement 1.6):** ماژول‌های legacy (`StrategicAlertModule`,
 * `ActionPlanModule`, `InteractionModule`, `FieldReportModule`) دست‌نخورده باقی
 * می‌مانند و در `app.module.ts` به‌صورت dual-import در کنار این ماژول ثبت‌اند.
 * تداخل مسیر با ثبت کنترلرها زیر فضای نام `/operations/*` رفع شده است.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StrategicAlert,
      ActionPlan,
      Interaction,
      FieldReport,
    ]),
  ],
  controllers: [
    AlertsController,
    ActionPlansController,
    InteractionsController,
    FieldReportsController,
  ],
  providers: [
    AlertsService,
    ActionPlansService,
    InteractionsService,
    FieldReportsService,
  ],
  exports: [
    AlertsService,
    ActionPlansService,
    InteractionsService,
    FieldReportsService,
  ],
})
export class OperationsModule {}
