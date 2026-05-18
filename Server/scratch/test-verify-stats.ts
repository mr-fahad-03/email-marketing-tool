import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Campaign } from '../src/modules/campaigns/schemas/campaign.schema';
import { TrackingEvent } from '../src/modules/tracking/schemas/tracking-event.schema';
import { Model } from 'mongoose';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const campaignModel = app.get<Model<Campaign>>(getModelToken(Campaign.name));
  const trackingEventModel = app.get<Model<TrackingEvent>>(getModelToken(TrackingEvent.name));

  const campaign = await campaignModel.findById('6a01c3385b159afbad5ada8a').lean().exec();
  console.log(`Campaign Stats:`, JSON.stringify(campaign?.stats, null, 2));

  const events = await trackingEventModel.find({ campaignId: '6a01c3385b159afbad5ada8a' }).lean().exec();
  console.log(`TrackingEvents:`, JSON.stringify(events, null, 2));

  await app.close();
}

run().catch(console.error);
