import { createHmac, randomBytes } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const tokenSecret = process.env.TRACKING_TOKEN_SECRET || 'replace-with-32-plus-character-secret-for-tracking-tokens';
const tokenTtlSeconds = Number(process.env.TRACKING_TOKEN_TTL_SECONDS) || 60 * 60 * 24 * 30;

function signPayload(data: any): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...data,
    iat: now,
    exp: now + tokenTtlSeconds,
    n: randomBytes(8).toString('hex'),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', tokenSecret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

async function run() {
  const context = {
    campaignId: '6a01c3385b159afbad5ada8a',
    campaignRecipientId: '6a01c33b38e642b5e6e83744',
    contactId: '6a01bb967f5a5f2b41c48e09',
  };

  const openToken = signPayload({
    t: 'open',
    cid: context.campaignId,
    crid: context.campaignRecipientId,
    ctid: context.contactId,
  });

  const clickToken = signPayload({
    t: 'click',
    cid: context.campaignId,
    crid: context.campaignRecipientId,
    ctid: context.contactId,
    u: 'https://www.google.com/',
  });

  console.log('Generated Open Token:', openToken);
  console.log('Generated Click Token:', clickToken);

  console.log('\nSending open tracking request to running server on port 5000...');
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
      redirect: 'manual', // don't follow redirect
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
