import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: ['http://localhost:3033', 'http://localhost:3032', 'http://127.0.0.1:3033', 'https://sm.pish.run', 'https://iransm.pish.run'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Serve downloaded media files (images, videos from crawling)
  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/static/' });

  // ValidationPipe سراسری (Requirement 12.4 / design §11.1):
  //  - whitelist: true  → ویژگی‌های غیرمجاز (خارج از DTO) حذف می‌شوند.
  //  - transform: true  → payload به نمونهٔ DTO تبدیل و انواع پایه coerce می‌شوند.
  // خطای اعتبارسنجی به‌صورت BadRequestException با آرایهٔ پیام‌ها پرتاب می‌شود و
  // از طریق AllExceptionsFilter (گام ۱.۳) به کد نمادین VALIDATION_ERROR با
  // details فیلد‌محور (details.messages) نگاشت می‌گردد.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // در محیط کانتینری/پروداکشن سرور باید روی `0.0.0.0` گوش دهد تا پراکسی معکوس
  // (Traefik/Nginx در Coolify) بتواند از بیرون کانتینر به آن برسد. بایند شدن روی
  // `localhost` داخل کانتینر باعث می‌شود پراکسی نتواند وصل شود و کلاینت خطای
  // «502 Bad Gateway» بگیرد (که در مرورگر به‌شکل خطای CORS دیده می‌شود).
  const host =
    process.env.HOST ||
    (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost');
  const port = process.env.PORT ?? 3000;

  await app.listen(port, host);
}

bootstrap()
  .then(() => {
    console.log(
      `Server is running on http://${
        process.env.HOST ||
        (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost')
      }:${process.env.PORT ?? 3000}`,
    );
  })
  .catch((err) => {
    console.log('error in running server', err);
  });
