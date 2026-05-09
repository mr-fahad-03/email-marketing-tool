import 'dotenv/config';
import 'reflect-metadata';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import { isAbsolute, join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const apiPrefix = configService.get<string>('app.apiPrefix', { infer: true }) ?? '';
  const port = configService.get<number>('app.port', { infer: true }) ?? 5000;
  const corsOrigins = configService.get<string[]>('app.corsOrigins', { infer: true }) ?? [];
  const configuredTemplateImagesDir =
    configService.get<string>('media.templateImages.uploadDir', { infer: true }) ??
    'uploads/template-images';
  const configuredTemplateImagesPublicPath =
    configService.get<string>('media.templateImages.publicPath', { infer: true }) ??
    '/uploads/template-images';
  const templateImagesPublicPathCandidate = configuredTemplateImagesPublicPath
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const templateImagesPublicPath = templateImagesPublicPathCandidate
    ? `/${templateImagesPublicPathCandidate}`
    : '/uploads/template-images';
  const templateImagesDir = isAbsolute(configuredTemplateImagesDir)
    ? configuredTemplateImagesDir
    : join(process.cwd(), configuredTemplateImagesDir);
  const configuredTemplateLibraryDir =
    configService.get<string>('media.templateLibrary.dir', { infer: true }) ??
    'assets/email-template-library/easy-email';
  const configuredTemplateLibraryPublicPath =
    configService.get<string>('media.templateLibrary.publicPath', { infer: true }) ??
    '/template-library/easy-email';
  const templateLibraryPublicPathCandidate = configuredTemplateLibraryPublicPath
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const templateLibraryPublicPath = templateLibraryPublicPathCandidate
    ? `/${templateLibraryPublicPathCandidate}`
    : '/template-library/easy-email';
  const templateLibraryDir = isAbsolute(configuredTemplateLibraryDir)
    ? configuredTemplateLibraryDir
    : join(process.cwd(), configuredTemplateLibraryDir);

  if (!existsSync(templateImagesDir)) {
    mkdirSync(templateImagesDir, { recursive: true });
  }

  app.use(templateImagesPublicPath, express.static(templateImagesDir));
  if (existsSync(templateLibraryDir)) {
    app.use(templateLibraryPublicPath, express.static(templateLibraryDir));
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix, {
      exclude: [{ path: 'health', method: RequestMethod.GET }],
    });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(port);
  const appUrl = await app.getUrl();
  const normalizedPrefix = apiPrefix ? `/${apiPrefix.replace(/^\/+/, '')}` : '';
  logger.log(`Application is running at ${appUrl}${normalizedPrefix}`);
  logger.log(`Health check available at ${appUrl}/health`);
}

void bootstrap();
