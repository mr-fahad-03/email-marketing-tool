import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TrackingTokenService } from '../src/modules/tracking/tracking-token.service';
import { TrackingService } from '../src/modules/tracking/tracking.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const tokenService = app.get(TrackingTokenService);
  const trackingService = app.get(TrackingService);

  const context = {
    campaignId: '6a01c3385b159afbad5ada8a',
    campaignRecipientId: '6a01c33b38e642b5e6e83744',
    contactId: '6a01bb967f5a5f2b41c48e09',
  };

  // 1. Let's test open tracking
  console.log('--- Testing Open Tracking ---');
  const openToken = tokenService.createOpenToken(context);
  const openResult = await trackingService.handleOpenTracking({
    token: openToken,
    ip: '::1',
    userAgent: 'TestUserAgent',
  });
  console.log('Open Result:', openResult);

  // 2. Let's test click tracking
  console.log('\n--- Testing Click Tracking ---');
  const clickToken = tokenService.createClickToken({
    ...context,
    url: 'https://www.google.com/',
  });
  const clickResult = await trackingService.handleClickTracking({
    token: clickToken,
    ip: '::1',
    userAgent: 'TestUserAgent',
  });
  console.log('Click Result:', clickResult);

  await app.close();
}

run().catch(console.error);
