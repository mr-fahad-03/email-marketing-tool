import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CampaignRecipient } from '../campaigns/schemas/campaign-recipient.schema';
import { TrackingAggregationService } from './tracking-aggregation.service';
import { TrackingEventType, TrackingTokenType } from './constants/tracking.enums';
import { TrackingEvent } from './schemas/tracking-event.schema';
import { TrackingTokenService } from './tracking-token.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectModel(CampaignRecipient.name)
    private readonly campaignRecipientModel: Model<CampaignRecipient>,
    @InjectModel(TrackingEvent.name)
    private readonly trackingEventModel: Model<TrackingEvent>,
    private readonly trackingTokenService: TrackingTokenService,
    private readonly trackingAggregationService: TrackingAggregationService,
  ) {}

  async handleOpenTracking(input: {
    token: string;
    ip?: string;
    userAgent?: string;
    referrer?: string;
  }): Promise<{ tracked: boolean; reason: string }> {
    const resolved = this.trackingTokenService.verifyToken(input.token);
    if (!resolved || resolved.type !== TrackingTokenType.OPEN) {
      return { tracked: false, reason: 'invalid_token' };
    }

    const context = await this.resolveRecipientContext(resolved);
    if (!context) {
      return { tracked: false, reason: 'recipient_context_not_found' };
    }

    const metadata = this.buildMetadata({
      ip: input.ip,
      userAgent: input.userAgent,
      referrer: input.referrer,
    });

    try {
      const unique = await this.isUniqueEventForRecipient(
        context.campaignRecipientId,
        TrackingEventType.OPEN,
      );

      await this.trackingEventModel.create({
        campaignId: context.campaignId,
        campaignRecipientId: context.campaignRecipientId,
        contactId: context.contactId,
        eventType: TrackingEventType.OPEN,
        metadata,
      });

      await this.trackingAggregationService.applyEvent({
        campaignId: context.campaignId,
        campaignRecipientId: context.campaignRecipientId,
        contactId: context.contactId,
        eventType: TrackingEventType.OPEN,
        metadata,
        isUniqueForRecipient: unique,
      });
      return { tracked: true, reason: 'tracked' };
    } catch (error) {
      this.logger.warn(
        `Failed to persist open tracking event for campaignRecipient=${context.campaignRecipientId.toString()}: ${(error as Error).message}`,
      );
      return { tracked: false, reason: 'persist_failed' };
    }
  }

  async handleClickTracking(input: {
    token: string;
    ip?: string;
    userAgent?: string;
    referrer?: string;
  }): Promise<{ redirectUrl: string | null; tracked: boolean; reason: string }> {
    const resolved = this.trackingTokenService.verifyToken(input.token);
    if (!resolved || resolved.type !== TrackingTokenType.CLICK || !resolved.url) {
      return {
        redirectUrl: null,
        tracked: false,
        reason: 'invalid_token',
      };
    }

    const context = await this.resolveRecipientContext(resolved);
    if (!context) {
      return {
        redirectUrl: resolved.url,
        tracked: false,
        reason: 'recipient_context_not_found',
      };
    }

    const metadata = this.buildMetadata({
      ip: input.ip,
      userAgent: input.userAgent,
      referrer: input.referrer,
      url: resolved.url,
    });

    try {
      const unique = await this.isUniqueEventForRecipient(
        context.campaignRecipientId,
        TrackingEventType.CLICK,
      );

      await this.trackingEventModel.create({
        campaignId: context.campaignId,
        campaignRecipientId: context.campaignRecipientId,
        contactId: context.contactId,
        eventType: TrackingEventType.CLICK,
        metadata,
      });

      await this.trackingAggregationService.applyEvent({
        campaignId: context.campaignId,
        campaignRecipientId: context.campaignRecipientId,
        contactId: context.contactId,
        eventType: TrackingEventType.CLICK,
        metadata,
        isUniqueForRecipient: unique,
      });
      return {
        redirectUrl: resolved.url,
        tracked: true,
        reason: 'tracked',
      };
    } catch (error) {
      this.logger.warn(
        `Failed to persist click tracking event for campaignRecipient=${context.campaignRecipientId.toString()}: ${(error as Error).message}`,
      );
      return {
        redirectUrl: resolved.url,
        tracked: false,
        reason: 'persist_failed',
      };
    }
  }

  private async resolveRecipientContext(resolved: {
    campaignId: string;
    campaignRecipientId: string;
    contactId: string;
  }): Promise<{
    campaignId: Types.ObjectId;
    campaignRecipientId: Types.ObjectId;
    contactId: Types.ObjectId;
  } | null> {
    const campaignId = this.toObjectId(resolved.campaignId);
    const campaignRecipientId = this.toObjectId(resolved.campaignRecipientId);
    const contactId = this.toObjectId(resolved.contactId);

    if (!campaignId || !campaignRecipientId || !contactId) {
      return null;
    }

    const recipient = await this.campaignRecipientModel
      .findById(campaignRecipientId)
      .select('_id campaignId contactId')
      .lean()
      .exec();

    if (!recipient) {
      return null;
    }

    if (String(recipient.campaignId) !== String(campaignId)) {
      return null;
    }

    if (String(recipient.contactId) !== String(contactId)) {
      return null;
    }

    return {
      campaignId,
      campaignRecipientId,
      contactId,
    };
  }

  private async isUniqueEventForRecipient(
    campaignRecipientId: Types.ObjectId,
    eventType: TrackingEventType,
  ): Promise<boolean> {
    const existing = await this.trackingEventModel
      .exists({
        campaignRecipientId,
        eventType,
      })
      .exec();

    return !Boolean(existing);
  }

  private toObjectId(id: string): Types.ObjectId | null {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return new Types.ObjectId(id);
  }

  private buildMetadata(input: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
    url?: string;
  }): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    if (input.ip) {
      metadata.ip = input.ip;
    }
    if (input.userAgent) {
      metadata.userAgent = input.userAgent;
    }
    if (input.referrer) {
      metadata.referrer = input.referrer;
    }
    if (input.url) {
      metadata.url = input.url;
    }
    return metadata;
  }
}
