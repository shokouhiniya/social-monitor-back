import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { getDatabaseConfig } from '../config/database.config';

// بارگذاری متغیرهای محیطی برای اجرای standalone از طریق TypeORM CLI.
loadEnv();

const dbConfig = getDatabaseConfig();

/**
 * DataSource مستقل برای TypeORM CLI (migration:generate / run / revert).
 *
 * این فایل خارج از context برنامهٔ NestJS اجرا می‌شود؛ بنابراین entityها و
 * migrationها را با glob بارگذاری می‌کند. هم مسیر `src` (اجرا با ts-node) و هم
 * مسیر `dist` (اجرای کامپایل‌شده) پوشش داده می‌شود.
 *
 * نکتهٔ مهم: `synchronize` همیشه false است (Requirement 13.1)؛ تغییر schema تنها
 * از طریق migration انجام می‌شود.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.name,
  synchronize: false,
  logging: dbConfig.logging,
  // entityها از هر دو ساختار قدیمی (modules/*) و جدید بارگذاری می‌شوند.
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
