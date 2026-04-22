import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: ['http://localhost:3033', 'http://127.0.0.1:3033'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/static/' });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? 'localhost');
}

bootstrap()
  .then(() => {
    console.log(
      `Server is running on http://${process.env.HOST ?? 'localhost'}:${process.env.PORT ?? 3000}`,
    );
  })
  .catch((err) => {
    console.log('error in running server', err);
  });
