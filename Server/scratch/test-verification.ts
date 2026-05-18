import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TrackingTokenService } from '../src/modules/tracking/tracking-token.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const tokenService = app.get(TrackingTokenService);

  const context = {
    campaignId: '6a01c3385b159afbad5ada8a',
    campaignRecipientId: '6a01c3385b159afbad5ada8b',
    contactId: '6a01c3385b159afbad5ada8c',
  };

  const openToken = tokenService.createOpenToken(context);
  console.log(`Generated Open Token: ${openToken}`);

  const verified = tokenService.verifyToken(openToken);
  console.log(`Verified Token Context:`, JSON.stringify(verified, null, 2));

  await app.close();
}

run().catch(console.error);
