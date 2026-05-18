import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { TrackingEvent } from '../src/modules/tracking/schemas/tracking-event.schema';
import { ContactActivity } from '../src/modules/tracking/schemas/contact-activity.schema';
import { Model } from 'mongoose';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const trackingEventModel = app.get<Model<TrackingEvent>>(getModelToken(TrackingEvent.name));
  const contactActivityModel = app.get<Model<ContactActivity>>(getModelToken(ContactActivity.name));

  const events = await trackingEventModel.find({ campaignId: '6a01c3385b159afbad5ada8a' }).lean().exec();
  console.log(`TrackingEvents for 6a01c3385b159afbad5ada8a:`, JSON.stringify(events, null, 2));

  const activities = await contactActivityModel.find({ campaignId: '6a01c3385b159afbad5ada8a' }).lean().exec();
  console.log(`ContactActivities for 6a01c3385b159afbad5ada8a:`, JSON.stringify(activities, null, 2));

  await app.close();
}

run().catch(console.error);
