import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TrackingTokenService } from '../src/modules/tracking/tracking-token.service';

async function run() {
  // 1. Generate valid tokens using app context (running briefly)
  const app = await NestFactory.createApplicationContext(AppModule);
  const tokenService = app.get(TrackingTokenService);

  const context = {
    campaignId: '6a01c3385b159afbad5ada8a',
    campaignRecipientId: '6a01c33b38e642b5e6e83744',
    contactId: '6a01bb967f5a5f2b41c48e09',
  };

  const openToken = tokenService.createOpenToken(context);
  const clickToken = tokenService.createClickToken({
    ...context,
    url: 'https://www.google.com/',
  });

  try {
    await app.close();
  } catch (err) {
    // Ignore close errors
  }

  // 2. Make real HTTP requests to the running server on port 5000 using fetch
  console.log('Sending open tracking request to running server on port 5000...');
  try {
    const openRes = await fetch(`http://localhost:5000/tracking/open/${encodeURIComponent(openToken)}`, {
      headers: {
        'User-Agent': 'NodeFetchTestAgent/1.0',
      }
    });
    console.log('Open Response Status:', openRes.status);
    console.log('Open Response Content-Type:', openRes.headers.get('content-type'));
  } catch (err: any) {
    console.error('Open Request Failed:', err.message);
  }

  console.log('\nSending click tracking request to running server on port 5000...');
  try {
    const clickRes = await fetch(`http://localhost:5000/tracking/click/${encodeURIComponent(clickToken)}`, {
      redirect: 'manual', // don't automatically follow redirect
      headers: {
        'User-Agent': 'NodeFetchTestAgent/1.0',
      }
    });
    console.log('Click Response Status:', clickRes.status);
    console.log('Click Redirect Location:', clickRes.headers.get('location'));
  } catch (err: any) {
    console.error('Click Request Failed:', err.message);
  }
}

run().catch(console.error);
