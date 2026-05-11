import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import {
  CampaignRecipient,
  CampaignRecipientSchema,
} from '../campaigns/schemas/campaign-recipient.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { SendEvent, SendEventSchema } from '../email/schemas/send-event.schema';
import {
  SenderAccount,
  SenderAccountSchema,
} from '../sender-accounts/schemas/sender-account.schema';
import { TrackingEvent, TrackingEventSchema } from '../tracking/schemas/tracking-event.schema';
import {
  WhatsappWebhookEvent,
  WhatsappWebhookEventSchema,
} from '../webhooks/schemas/whatsapp-webhook-event.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    AuthModule,
    WorkspacesModule,
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: CampaignRecipient.name, schema: CampaignRecipientSchema },
      { name: SenderAccount.name, schema: SenderAccountSchema },
      { name: SendEvent.name, schema: SendEventSchema },
      { name: TrackingEvent.name, schema: TrackingEventSchema },
      { name: WhatsappWebhookEvent.name, schema: WhatsappWebhookEventSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
