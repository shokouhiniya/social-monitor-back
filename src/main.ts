import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3033', 'http://localhost:3032', 'http://127.0.0.1:3033', 'https://sm.pish.run'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Transform DTO to plain object
      // whitelist: true, // Strip out properties that are not in the DTO
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
