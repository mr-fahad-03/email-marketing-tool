import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  CAMPAIGN_CHANNEL_VALUES,
  CAMPAIGN_DISTRIBUTION_STRATEGY_VALUES,
  CAMPAIGN_STATUS_VALUES,
  CampaignChannel,
  CampaignDistributionStrategy,
  CampaignStatus,
} from '../constants/campaign.enums';

@Schema({ _id: false })
export class CampaignSettings {
  @Prop({
    type: String,
    enum: CAMPAIGN_DISTRIBUTION_STRATEGY_VALUES,
    default: CampaignDistributionStrategy.ROUND_ROBIN,
  })
  distributionStrategy!: CampaignDistributionStrategy;
}

@Schema({ _id: false })
export class CampaignStats {
  @Prop({ type: Number, default: 0, min: 0 })
  totalRecipients!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  queuedRecipients!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  skippedRecipients!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  sentRecipients!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  failedRecipients!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  openCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  uniqueOpenCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  clickCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  uniqueClickCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  whatsappSentCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  whatsappDeliveredCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  whatsappReadCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  whatsappFailedCount!: number;

  @Prop({ type: Date, default: null })
  lastStartedAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastOpenedAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastClickedAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastWhatsappStatusAt!: Date | null;
}

@Schema({ timestamps: true, collection: 'campaigns' })
export class Campaign {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 140 })
  name!: string;

  @Prop({ type: String, enum: CAMPAIGN_CHANNEL_VALUES, required: true, index: true })
  channel!: CampaignChannel;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'SenderAccount', default: [] })
  senderAccountIds!: Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Segment', default: null })
  segmentId!: Types.ObjectId | null;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Contact', default: [] })
  contactIds!: Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Template', required: true })
  templateId!: Types.ObjectId;

  @Prop({ type: String, enum: CAMPAIGN_STATUS_VALUES, default: CampaignStatus.DRAFT, index: true })
  status!: CampaignStatus;

  @Prop({ type: String, default: 'UTC' })
  timezone!: string;

  @Prop({ type: Date, default: null })
  startAt!: Date | null;

  @Prop({ type: String, default: null })
  sendingWindowStart!: string | null;

  @Prop({ type: String, default: null })
  sendingWindowEnd!: string | null;

  @Prop({ type: Number, default: null, min: 1 })
  dailyCap!: number | null;

  @Prop({ type: Boolean, default: true })
  trackOpens!: boolean;

  @Prop({ type: Boolean, default: true })
  trackClicks!: boolean;

  @Prop({ type: Number, default: 0, min: 0 })
  randomDelayMinSeconds!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  randomDelayMaxSeconds!: number;

  @Prop({ type: CampaignSettings, default: () => ({}) })
  settings!: CampaignSettings;

  @Prop({ type: String, default: null })
  trackingBaseUrl!: string | null;

  @Prop({ type: CampaignStats, default: () => ({}) })
  stats!: CampaignStats;

  @Prop({ type: Date, default: null })
  editedAt!: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type CampaignDocument = HydratedDocument<Campaign>;
export const CampaignSchema = SchemaFactory.createForClass(Campaign);

CampaignSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
