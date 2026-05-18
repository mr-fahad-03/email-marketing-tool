import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { TrackingEvent } from '../src/modules/tracking/schemas/tracking-event.schema';
import { Model, Types } from 'mongoose';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const trackingEventModel = app.get<Model<TrackingEvent>>(getModelToken(TrackingEvent.name));

  const fakeId = new Types.ObjectId();
  const res = await trackingEventModel.exists({
    campaignRecipientId: fakeId,
    eventType: 'open'
  }).exec();

  console.log('Result of exists for fake ID:', res);
  console.log('typeof res:', typeof res);
  console.log('Boolean(res):', Boolean(res));

  await app.close();
}

run().catch(console.error);
