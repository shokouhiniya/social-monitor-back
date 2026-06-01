import * as process from 'node:process';

/**
 * منبع واحد پیکربندی دیتابیس برای V2.
 *
 * مقدار `synchronize` در **همهٔ محیط‌ها** (development / staging / production)
 * به‌صورت سخت‌گیرانه `false` است (Requirement 13.1). هر تغییر schema باید تنها
 * از طریق یک migration صریح TypeORM در `database/migrations/` انجام شود.
 * این مقدار را هرگز به `true` برنگردانید.
 *
 * این config هم توسط `DatabaseModule` (از طریق `configuration.ts`) و هم توسط
 * `database/data-source.ts` (برای TypeORM CLI) مصرف می‌شود تا یک منبع واحد حقیقت
 * برای اتصال دیتابیس وجود داشته باشد.
 */
export interface DatabaseConfig {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  /** نام دیتابیس؛ در گزینه‌های اتصال TypeORM به `database` نگاشت می‌شود. */
  name: string;
  /** همیشه false — تغییر schema تنها از طریق migration (Req 13.1). */
  synchronize: false;
  autoLoadEntities: boolean;
  logging: boolean;
}

export const getDatabaseConfig = (): DatabaseConfig => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'secret',
  name: process.env.DB_NAME || 'postgres',
  // هرگز true نشود — همهٔ محیط‌ها (شامل staging) فقط با migration کار می‌کنند.
  synchronize: false,
  autoLoadEntities:
    (process.env.DB_AUTOLOADENTITIES ?? 'true').toString().toLowerCase() !==
    'false',
  logging: process.env.NODE_ENV !== 'production',
});
