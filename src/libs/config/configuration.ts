import * as process from 'node:process';
import { getDatabaseConfig } from '../../config/database.config';
import { getJobsConfig } from '../../config/jobs.config';

export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',
  // منبع واحد پیکربندی دیتابیس؛ synchronize در همهٔ محیط‌ها false است (Req 13.1).
  database: getDatabaseConfig(),
  // پیکربندی Job Center / JobWorker — concurrency قابل‌پیکربندی (Requirement 10.9).
  jobs: getJobsConfig(),
  jwt: {
    secret: process.env.JWT_SECRET || 'secretKey',
    expiresIn: process.env.JWT_EXPIRES_IN || '60m',
  },

  appName: process.env.APP_NAME || 'Pishrun Project',
});
