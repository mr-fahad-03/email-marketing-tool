import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventQueryFiltersDto } from '../../common/dto/event-query-filters.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthUser } from '../../common/types/auth-user.type';
import { CampaignChannel } from '../campaigns/constants/campaign.enums';
import { CampaignRecipient } from '../campaigns/schemas/campaign-recipient.schema';
import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import { EmailSendEventType } from '../email/constants/email.enums';
import { SendEvent } from '../email/schemas/send-event.schema';
import { SenderAccount } from '../sender-accounts/schemas/sender-account.schema';
import { TrackingEvent } from '../tracking/schemas/tracking-event.schema';
import { WhatsappWebhookEvent } from '../webhooks/schemas/whatsapp-webhook-event.schema';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<Campaign>,
    @InjectModel(CampaignRecipient.name)
    private readonly campaignRecipientModel: Model<CampaignRecipient>,
    @InjectModel(SenderAccount.name)
    private readonly senderAccountModel: Model<SenderAccount>,
    @InjectModel(SendEvent.name)
    private readonly sendEventModel: Model<SendEvent>,
    @InjectModel(TrackingEvent.name)
    private readonly trackingEventModel: Model<TrackingEvent>,
    @InjectModel(WhatsappWebhookEvent.name)
    private readonly webhookEventModel: Model<WhatsappWebhookEvent>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async getCampaignAnalytics(
    campaignIdentifier: string,
    filters: EventQueryFiltersDto,
    authUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const workspaceObjectId = this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID');
    const campaign = await this.findOwnedCampaignByIdentifier(
      campaignIdentifier,
      workspaceObjectId,
    );
    const campaignObjectId = this.toObjectId(campaign.id, 'INVALID_CAMPAIGN_ID');

    const sendEventMatch = this.buildSendEventMatch({
      workspaceId: workspaceObjectId,
      campaignId: campaignObjectId,
      filters,
      forceCampaign: true,
    });

    const sendEventRows = await this.sendEventModel
      .aggregate<{ _id: string; count: number; lastEventAt: Date | null }>([
        { $match: sendEventMatch },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            lastEventAt: { $max: '$createdAt' },
          },
        },
      ])
      .exec();

    const sendEventAgg = {
      totalEvents: 0,
      eventBreakdown: {} as Record<string, number>,
      lastEventAt: null as Date | null,
    };

    for (const row of sendEventRows) {
      sendEventAgg.eventBreakdown[String(row._id)] = row.count;
      sendEventAgg.totalEvents += row.count;
      if (
        !sendEventAgg.lastEventAt ||
        (row.lastEventAt && row.lastEventAt > sendEventAgg.lastEventAt)
      ) {
        sendEventAgg.lastEventAt = row.lastEventAt ?? null;
      }
    }

    const trackingMatch = this.buildTrackingEventMatch({
      campaignId: campaignObjectId,
      filters,
    });

    const trackingChannelBlocked = filters.channel === CampaignChannel.WHATSAPP;
    const [trackingAgg] = trackingChannelBlocked
      ? [{ totalEvents: 0, openCount: 0, clickCount: 0, lastEventAt: null as Date | null }]
      : await this.trackingEventModel
          .aggregate<{
            totalEvents: number;
            openCount: number;
            clickCount: number;
            lastEventAt: Date | null;
          }>([
            { $match: trackingMatch },
            {
              $group: {
                _id: null,
                totalEvents: { $sum: 1 },
                openCount: {
                  $sum: {
                    $cond: [{ $eq: ['$eventType', 'open'] }, 1, 0],
                  },
                },
                clickCount: {
                  $sum: {
                    $cond: [{ $eq: ['$eventType', 'click'] }, 1, 0],
                  },
                },
                lastEventAt: { $max: '$createdAt' },
              },
            },
            {
              $project: {
                _id: 0,
                totalEvents: 1,
                openCount: 1,
                clickCount: 1,
                lastEventAt: 1,
              },
            },
          ])
          .exec()
          .then((rows) =>
            rows.length
              ? rows
              : [{ totalEvents: 0, openCount: 0, clickCount: 0, lastEventAt: null }],
          );

    const webhookMatch = this.buildWebhookEventMatch({
      campaignId: campaignObjectId,
      filters,
    });

    const webhookChannelBlocked = filters.channel === CampaignChannel.EMAIL;
    const [webhookAgg] = webhookChannelBlocked
      ? [
          {
            totalEvents: 0,
            sentCount: 0,
            deliveredCount: 0,
            readCount: 0,
            failedCount: 0,
            lastEventAt: null as Date | null,
          },
        ]
      : await this.webhookEventModel
          .aggregate<{
            totalEvents: number;
            sentCount: number;
            deliveredCount: number;
            readCount: number;
            failedCount: number;
            lastEventAt: Date | null;
          }>([
            { $match: webhookMatch },
            {
              $group: {
                _id: null,
                totalEvents: { $sum: 1 },
                sentCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'sent'] }, 1, 0],
                  },
                },
                deliveredCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0],
                  },
                },
                readCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'read'] }, 1, 0],
                  },
                },
                failedCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
                  },
                },
                lastEventAt: { $max: '$createdAt' },
              },
            },
            {
              $project: {
                _id: 0,
                totalEvents: 1,
                sentCount: 1,
                deliveredCount: 1,
                readCount: 1,
                failedCount: 1,
                lastEventAt: 1,
              },
            },
          ])
          .exec()
          .then((rows) =>
            rows.length
              ? rows
              : [
                  {
                    totalEvents: 0,
                    sentCount: 0,
                    deliveredCount: 0,
                    readCount: 0,
                    failedCount: 0,
                    lastEventAt: null,
                  },
                ],
          );

    const sendSuccess = sendEventAgg.eventBreakdown[EmailSendEventType.SEND_SUCCESS] ?? 0;
    const totalSent = campaign.stats?.sentRecipients ?? 0;
    const totalFailed = campaign.stats?.failedRecipients ?? 0;
    const totalRecipients = campaign.stats?.totalRecipients ?? 0;
    const totalOpens = campaign.stats?.openCount ?? 0;
    const totalClicks = campaign.stats?.clickCount ?? 0;

    const deliveredCount =
      campaign.channel === CampaignChannel.WHATSAPP
        ? campaign.stats?.whatsappDeliveredCount ?? 0
        : totalSent;
    const bouncedCount = sendEventAgg.eventBreakdown[EmailSendEventType.SEND_FAILED_TEMPORARY] ?? 0;
    const pendingCount = Math.max(totalRecipients - totalSent - totalFailed, 0);

    const openRate = this.safeDivide(campaign.stats?.uniqueOpenCount ?? 0, sendSuccess);
    const clickRate = this.safeDivide(campaign.stats?.uniqueClickCount ?? 0, sendSuccess);
    const deliveryRate =
      campaign.channel === CampaignChannel.WHATSAPP
        ? this.safeDivide(webhookAgg.deliveredCount, Math.max(webhookAgg.sentCount, 1))
        : this.safeDivide(totalSent, Math.max(totalRecipients, 1));
    const readRate = this.safeDivide(webhookAgg.readCount, webhookAgg.deliveredCount);
    const failureRate = this.safeDivide(totalFailed, totalRecipients);

    const timeline = await this.buildCampaignTimeline({
      campaign,
      sendEventMatch,
      trackingMatch,
    });

    const senderPerformance = await this.buildCampaignSenderPerformance({
      campaign,
      sendEventMatch,
      trackingMatch,
    });

    const stats = {
      sent: totalSent,
      delivered: deliveredCount,
      opens: totalOpens,
      clicks: totalClicks,
      bounced: bouncedCount,
      failed: totalFailed,
      openRate: this.toPercent(openRate),
      clickRate: this.toPercent(clickRate),
      deliveryRate: this.toPercent(deliveryRate),
    };

    return {
      campaign: {
        id: campaign.id,
        workspaceId: campaign.workspaceId.toString(),
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      },
      summary: {
        recipients: {
          total: campaign.stats?.totalRecipients ?? 0,
          queued: campaign.stats?.queuedRecipients ?? 0,
          skipped: campaign.stats?.skippedRecipients ?? 0,
          sent: campaign.stats?.sentRecipients ?? 0,
          failed: campaign.stats?.failedRecipients ?? 0,
        },
        engagement: {
          opens: campaign.stats?.openCount ?? 0,
          uniqueOpens: campaign.stats?.uniqueOpenCount ?? 0,
          clicks: campaign.stats?.clickCount ?? 0,
          uniqueClicks: campaign.stats?.uniqueClickCount ?? 0,
        },
        whatsapp: {
          sent: campaign.stats?.whatsappSentCount ?? 0,
          delivered: campaign.stats?.whatsappDeliveredCount ?? 0,
          read: campaign.stats?.whatsappReadCount ?? 0,
          failed: campaign.stats?.whatsappFailedCount ?? 0,
        },
        rates: {
          openRate,
          clickRate,
          deliveryRate,
          readRate,
          failureRate,
        },
      },
      stats,
      timeline,
      senderPerformance,
      delivery: {
        delivered: deliveredCount,
        bounced: bouncedCount,
        failed: totalFailed,
        pending: pendingCount,
      },
      filteredEventCounts: {
        sendEvents: sendEventAgg.totalEvents,
        trackingEvents: trackingAgg.totalEvents,
        webhookEvents: webhookAgg.totalEvents,
        totalEvents: sendEventAgg.totalEvents + trackingAgg.totalEvents + webhookAgg.totalEvents,
      },
      filteredBreakdown: {
        send: sendEventAgg.eventBreakdown,
        tracking: {
          open: trackingAgg.openCount,
          click: trackingAgg.clickCount,
        },
        webhook: {
          sent: webhookAgg.sentCount,
          delivered: webhookAgg.deliveredCount,
          read: webhookAgg.readCount,
          failed: webhookAgg.failedCount,
        },
      },
      lastActivityAt: this.maxDate(
        sendEventAgg.lastEventAt,
        trackingAgg.lastEventAt,
        webhookAgg.lastEventAt,
      ),
      filterContext: this.buildFilterContext(filters, campaign.id),
    };
  }

  private async buildCampaignTimeline(input: {
    campaign: CampaignDocument;
    sendEventMatch: Record<string, unknown>;
    trackingMatch: Record<string, unknown>;
  }): Promise<Array<{ label: string; sent: number; delivered: number; opens: number; clicks: number }>> {
    const isEmailCampaign = input.campaign.channel === CampaignChannel.EMAIL;
    const sentEventType = isEmailCampaign
      ? EmailSendEventType.SEND_SUCCESS
      : EmailSendEventType.WHATSAPP_STATUS_SENT;
    const deliveredEventType = isEmailCampaign
      ? EmailSendEventType.SEND_SUCCESS
      : EmailSendEventType.WHATSAPP_STATUS_DELIVERED;

    const sendTimelineRows = await this.sendEventModel
      .aggregate<{ label: string; sent: number; delivered: number }>([
        { $match: input.sendEventMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
            sent: {
              $sum: {
                $cond: [{ $eq: ['$eventType', sentEventType] }, 1, 0],
              },
            },
            delivered: {
              $sum: {
                $cond: [{ $eq: ['$eventType', deliveredEventType] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            label: '$_id',
            sent: 1,
            delivered: 1,
          },
        },
        { $sort: { label: 1 } },
      ])
      .exec();

    const timelineByLabel = new Map<
      string,
      { label: string; sent: number; delivered: number; opens: number; clicks: number }
    >();

    for (const row of sendTimelineRows) {
      timelineByLabel.set(row.label, {
        label: row.label,
        sent: row.sent,
        delivered: row.delivered,
        opens: 0,
        clicks: 0,
      });
    }

    if (isEmailCampaign) {
      const trackingTimelineRows = await this.trackingEventModel
        .aggregate<{ label: string; opens: number; clicks: number }>([
          { $match: input.trackingMatch },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: 'UTC',
                },
              },
              opens: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', 'open'] }, 1, 0],
                },
              },
              clicks: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', 'click'] }, 1, 0],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              label: '$_id',
              opens: 1,
              clicks: 1,
            },
          },
          { $sort: { label: 1 } },
        ])
        .exec();

      for (const row of trackingTimelineRows) {
        const existing = timelineByLabel.get(row.label);
        if (existing) {
          existing.opens = row.opens;
          existing.clicks = row.clicks;
          continue;
        }

        timelineByLabel.set(row.label, {
          label: row.label,
          sent: 0,
          delivered: 0,
          opens: row.opens,
          clicks: row.clicks,
        });
      }
    }

    const timeline = Array.from(timelineByLabel.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );

    if (timeline.length) {
      return timeline;
    }

    const nowLabel = new Date().toISOString().slice(0, 10);
    return [{ label: nowLabel, sent: 0, delivered: 0, opens: 0, clicks: 0 }];
  }

  private async buildCampaignSenderPerformance(input: {
    campaign: CampaignDocument;
    sendEventMatch: Record<string, unknown>;
    trackingMatch: Record<string, unknown>;
  }): Promise<
    Array<{
      senderAccountId: string;
      senderName: string;
      sent: number;
      delivered: number;
      opens: number;
      clicks: number;
      deliveryRate: number;
      openRate: number;
      clickRate: number;
    }>
  > {
    const isEmailCampaign = input.campaign.channel === CampaignChannel.EMAIL;
    const sentEventType = isEmailCampaign
      ? EmailSendEventType.SEND_SUCCESS
      : EmailSendEventType.WHATSAPP_STATUS_SENT;
    const deliveredEventType = isEmailCampaign
      ? EmailSendEventType.SEND_SUCCESS
      : EmailSendEventType.WHATSAPP_STATUS_DELIVERED;

    const sendRows = await this.sendEventModel
      .aggregate<{
        senderAccountId: Types.ObjectId;
        sent: number;
        delivered: number;
      }>([
        { $match: input.sendEventMatch },
        {
          $group: {
            _id: '$senderAccountId',
            sent: {
              $sum: {
                $cond: [{ $eq: ['$eventType', sentEventType] }, 1, 0],
              },
            },
            delivered: {
              $sum: {
                $cond: [{ $eq: ['$eventType', deliveredEventType] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            senderAccountId: '$_id',
            sent: 1,
            delivered: 1,
          },
        },
      ])
      .exec();

    const engagementBySender = new Map<string, { opens: number; clicks: number }>();
    if (isEmailCampaign) {
      const trackingRows = await this.trackingEventModel
        .aggregate<{ senderAccountId: Types.ObjectId; opens: number; clicks: number }>([
          { $match: input.trackingMatch },
          {
            $lookup: {
              from: this.campaignRecipientModel.collection.name,
              localField: 'campaignRecipientId',
              foreignField: '_id',
              as: 'recipient',
            },
          },
          { $unwind: '$recipient' },
          {
            $group: {
              _id: '$recipient.senderAccountId',
              opens: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', 'open'] }, 1, 0],
                },
              },
              clicks: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', 'click'] }, 1, 0],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              senderAccountId: '$_id',
              opens: 1,
              clicks: 1,
            },
          },
        ])
        .exec();

      for (const row of trackingRows) {
        engagementBySender.set(row.senderAccountId.toString(), {
          opens: row.opens,
          clicks: row.clicks,
        });
      }
    }

    const senderIds = sendRows.map((row) => row.senderAccountId);
    const senders = senderIds.length
      ? await this.senderAccountModel
          .find({ _id: { $in: senderIds } })
          .select('_id name')
          .lean()
          .exec()
      : [];
    const senderNameById = new Map(senders.map((sender) => [String(sender._id), sender.name]));

    return sendRows.map((row) => {
      const senderId = row.senderAccountId.toString();
      const engagement = engagementBySender.get(senderId) ?? { opens: 0, clicks: 0 };
      const delivered = row.delivered;
      const sent = row.sent;

      return {
        senderAccountId: senderId,
        senderName: senderNameById.get(senderId) ?? 'Sender',
        sent,
        delivered,
        opens: engagement.opens,
        clicks: engagement.clicks,
        deliveryRate: this.toPercent(this.safeDivide(delivered, Math.max(sent, 1))),
        openRate: this.toPercent(this.safeDivide(engagement.opens, Math.max(delivered, 1))),
        clickRate: this.toPercent(this.safeDivide(engagement.clicks, Math.max(delivered, 1))),
      };
    });
  }

  private async findOwnedCampaignByIdentifier(
    campaignIdentifier: string,
    workspaceObjectId: Types.ObjectId,
  ): Promise<CampaignDocument> {
    const normalizedIdentifier = campaignIdentifier.trim();
    if (!normalizedIdentifier) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAMPAIGN_IDENTIFIER_REQUIRED',
        'Campaign name or ID is required',
      );
    }

    if (Types.ObjectId.isValid(normalizedIdentifier)) {
      const byId = await this.campaignModel
        .findOne({
          _id: new Types.ObjectId(normalizedIdentifier),
          workspaceId: workspaceObjectId,
        })
        .exec();

      if (byId) {
        return byId;
      }
    }

    const exactName = new RegExp(`^${this.escapeRegex(normalizedIdentifier)}$`, 'i');
    const byName = await this.campaignModel
      .find({
        workspaceId: workspaceObjectId,
        name: exactName,
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(2)
      .exec();

    if (!byName.length) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'CAMPAIGN_NOT_FOUND',
        `Campaign "${normalizedIdentifier}" not found`,
      );
    }

    if (byName.length > 1) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CAMPAIGN_NAME_NOT_UNIQUE',
        `Multiple campaigns found for name "${normalizedIdentifier}". Use campaign ID instead.`,
      );
    }

    return byName[0];
  }

  async getSenderAnalytics(
    senderId: string,
    filters: EventQueryFiltersDto,
    authUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const workspaceObjectId = this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID');
    const senderObjectId = this.toObjectId(senderId, 'INVALID_SENDER_ID');

    const sender = await this.senderAccountModel
      .findOne({
        _id: senderObjectId,
        workspaceId: workspaceObjectId,
      })
      .exec();

    if (!sender) {
      throw new AppException(HttpStatus.NOT_FOUND, 'SENDER_NOT_FOUND', 'Sender account not found');
    }

    const match = this.buildSendEventMatch({
      workspaceId: workspaceObjectId,
      senderId: senderObjectId,
      filters,
      forceSender: true,
    });

    const [senderSummary] = await this.sendEventModel
      .aggregate<{
        totalEvents: number;
        uniqueCampaignCount: number;
        uniqueContactCount: number;
        sendAttemptCount: number;
        sendSuccessCount: number;
        retryScheduledCount: number;
        failedTemporaryCount: number;
        failedPermanentCount: number;
        skippedSuppressedCount: number;
        whatsappStatusSentCount: number;
        whatsappStatusDeliveredCount: number;
        whatsappStatusReadCount: number;
        whatsappStatusFailedCount: number;
        lastEventAt: Date | null;
      }>([
        { $match: match },
        {
          $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            uniqueCampaignIds: { $addToSet: '$campaignId' },
            uniqueContactIds: { $addToSet: '$contactId' },
            sendAttemptCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.SEND_ATTEMPT] }, 1, 0],
              },
            },
            sendSuccessCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.SEND_SUCCESS] }, 1, 0],
              },
            },
            retryScheduledCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.SEND_RETRY_SCHEDULED] }, 1, 0],
              },
            },
            failedTemporaryCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.SEND_FAILED_TEMPORARY] }, 1, 0],
              },
            },
            failedPermanentCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.SEND_FAILED_PERMANENT] }, 1, 0],
              },
            },
            skippedSuppressedCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.SEND_SKIPPED_SUPPRESSED] }, 1, 0],
              },
            },
            whatsappStatusSentCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.WHATSAPP_STATUS_SENT] }, 1, 0],
              },
            },
            whatsappStatusDeliveredCount: {
              $sum: {
                $cond: [
                  { $eq: ['$eventType', EmailSendEventType.WHATSAPP_STATUS_DELIVERED] },
                  1,
                  0,
                ],
              },
            },
            whatsappStatusReadCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.WHATSAPP_STATUS_READ] }, 1, 0],
              },
            },
            whatsappStatusFailedCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.WHATSAPP_STATUS_FAILED] }, 1, 0],
              },
            },
            lastEventAt: { $max: '$createdAt' },
          },
        },
        {
          $project: {
            _id: 0,
            totalEvents: 1,
            uniqueCampaignCount: { $size: '$uniqueCampaignIds' },
            uniqueContactCount: { $size: '$uniqueContactIds' },
            sendAttemptCount: 1,
            sendSuccessCount: 1,
            retryScheduledCount: 1,
            failedTemporaryCount: 1,
            failedPermanentCount: 1,
            skippedSuppressedCount: 1,
            whatsappStatusSentCount: 1,
            whatsappStatusDeliveredCount: 1,
            whatsappStatusReadCount: 1,
            whatsappStatusFailedCount: 1,
            lastEventAt: 1,
          },
        },
      ])
      .exec()
      .then((rows) =>
        rows.length
          ? rows
          : [
              {
                totalEvents: 0,
                uniqueCampaignCount: 0,
                uniqueContactCount: 0,
                sendAttemptCount: 0,
                sendSuccessCount: 0,
                retryScheduledCount: 0,
                failedTemporaryCount: 0,
                failedPermanentCount: 0,
                skippedSuppressedCount: 0,
                whatsappStatusSentCount: 0,
                whatsappStatusDeliveredCount: 0,
                whatsappStatusReadCount: 0,
                whatsappStatusFailedCount: 0,
                lastEventAt: null,
              },
            ],
      );

    const byCampaign = await this.sendEventModel
      .aggregate<{
        campaignId: Types.ObjectId;
        totalEvents: number;
        successCount: number;
        failureCount: number;
        lastEventAt: Date | null;
      }>([
        { $match: match },
        {
          $group: {
            _id: '$campaignId',
            totalEvents: { $sum: 1 },
            successCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.SEND_SUCCESS] }, 1, 0],
              },
            },
            failureCount: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$eventType',
                      [
                        EmailSendEventType.SEND_FAILED_TEMPORARY,
                        EmailSendEventType.SEND_FAILED_PERMANENT,
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            lastEventAt: { $max: '$createdAt' },
          },
        },
        {
          $project: {
            _id: 0,
            campaignId: '$_id',
            totalEvents: 1,
            successCount: 1,
            failureCount: 1,
            lastEventAt: 1,
          },
        },
        { $sort: { lastEventAt: -1 } },
        { $limit: 25 },
      ])
      .exec();

    const byChannel = await this.sendEventModel
      .aggregate<{
        channel: string;
        totalEvents: number;
        successCount: number;
        failureCount: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: '$channel',
            totalEvents: { $sum: 1 },
            successCount: {
              $sum: {
                $cond: [{ $eq: ['$eventType', EmailSendEventType.SEND_SUCCESS] }, 1, 0],
              },
            },
            failureCount: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$eventType',
                      [
                        EmailSendEventType.SEND_FAILED_TEMPORARY,
                        EmailSendEventType.SEND_FAILED_PERMANENT,
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            channel: '$_id',
            totalEvents: 1,
            successCount: 1,
            failureCount: 1,
          },
        },
      ])
      .exec();

    return {
      sender: {
        id: sender.id,
        workspaceId: sender.workspaceId.toString(),
        name: sender.name,
        channelType: sender.channelType,
        status: sender.status,
        lastTestedAt: sender.lastTestedAt,
      },
      summary: {
        totalEvents: senderSummary.totalEvents,
        uniqueCampaigns: senderSummary.uniqueCampaignCount,
        uniqueContacts: senderSummary.uniqueContactCount,
        sendAttempts: senderSummary.sendAttemptCount,
        sendSuccesses: senderSummary.sendSuccessCount,
        retriesScheduled: senderSummary.retryScheduledCount,
        temporaryFailures: senderSummary.failedTemporaryCount,
        permanentFailures: senderSummary.failedPermanentCount,
        suppressedSkips: senderSummary.skippedSuppressedCount,
        whatsappStatus: {
          sent: senderSummary.whatsappStatusSentCount,
          delivered: senderSummary.whatsappStatusDeliveredCount,
          read: senderSummary.whatsappStatusReadCount,
          failed: senderSummary.whatsappStatusFailedCount,
        },
      },
      rates: {
        successRate: this.safeDivide(
          senderSummary.sendSuccessCount,
          senderSummary.sendAttemptCount,
        ),
        deliveryRate: this.safeDivide(
          senderSummary.whatsappStatusDeliveredCount,
          senderSummary.whatsappStatusSentCount,
        ),
        readRate: this.safeDivide(
          senderSummary.whatsappStatusReadCount,
          senderSummary.whatsappStatusDeliveredCount,
        ),
      },
      byCampaign: byCampaign.map((item) => ({
        campaignId: item.campaignId.toString(),
        totalEvents: item.totalEvents,
        successCount: item.successCount,
        failureCount: item.failureCount,
        lastEventAt: item.lastEventAt,
      })),
      byChannel: byChannel.map((item) => ({
        channel: item.channel,
        totalEvents: item.totalEvents,
        successCount: item.successCount,
        failureCount: item.failureCount,
      })),
      lastActivityAt: senderSummary.lastEventAt,
      filterContext: this.buildFilterContext(filters),
    };
  }

  private buildSendEventMatch(input: {
    workspaceId: Types.ObjectId;
    campaignId?: Types.ObjectId;
    senderId?: Types.ObjectId;
    filters: EventQueryFiltersDto;
    forceCampaign?: boolean;
    forceSender?: boolean;
  }): Record<string, unknown> {
    const match: Record<string, unknown> = {
      workspaceId: input.workspaceId,
    };

    const campaignId =
      input.forceCampaign && input.campaignId
        ? input.campaignId
        : this.optionalObjectId(input.filters.campaignId, 'INVALID_CAMPAIGN_ID');
    const senderId =
      input.forceSender && input.senderId
        ? input.senderId
        : this.optionalObjectId(input.filters.senderId, 'INVALID_SENDER_ID');
    const contactId = this.optionalObjectId(input.filters.contactId, 'INVALID_CONTACT_ID');

    if (campaignId) {
      match.campaignId = campaignId;
    }
    if (senderId) {
      match.senderAccountId = senderId;
    }
    if (contactId) {
      match.contactId = contactId;
    }
    if (input.filters.channel) {
      match.channel = input.filters.channel;
    }
    if (input.filters.eventType?.length) {
      match.eventType = { $in: input.filters.eventType };
    }

    const dateRange = this.buildDateRange(input.filters.dateFrom, input.filters.dateTo);
    if (dateRange) {
      match.createdAt = dateRange;
    }

    return match;
  }

  private buildTrackingEventMatch(input: {
    campaignId: Types.ObjectId;
    filters: EventQueryFiltersDto;
  }): Record<string, unknown> {
    const match: Record<string, unknown> = {
      campaignId: input.campaignId,
    };

    const contactId = this.optionalObjectId(input.filters.contactId, 'INVALID_CONTACT_ID');
    if (contactId) {
      match.contactId = contactId;
    }

    if (input.filters.eventType?.length) {
      match.eventType = { $in: input.filters.eventType };
    }

    const dateRange = this.buildDateRange(input.filters.dateFrom, input.filters.dateTo);
    if (dateRange) {
      match.createdAt = dateRange;
    }

    return match;
  }

  private buildWebhookEventMatch(input: {
    campaignId: Types.ObjectId;
    filters: EventQueryFiltersDto;
  }): Record<string, unknown> {
    const match: Record<string, unknown> = {
      campaignId: input.campaignId,
      processed: true,
    };

    const senderId = this.optionalObjectId(input.filters.senderId, 'INVALID_SENDER_ID');
    const contactId = this.optionalObjectId(input.filters.contactId, 'INVALID_CONTACT_ID');

    if (senderId) {
      match.senderAccountId = senderId;
    }
    if (contactId) {
      match.contactId = contactId;
    }
    if (input.filters.eventType?.length) {
      match.status = { $in: input.filters.eventType };
    }

    const dateRange = this.buildDateRange(input.filters.dateFrom, input.filters.dateTo);
    if (dateRange) {
      match.createdAt = dateRange;
    }

    return match;
  }

  private buildDateRange(
    dateFrom?: string,
    dateTo?: string,
  ): { $gte?: Date; $lte?: Date } | undefined {
    const range: { $gte?: Date; $lte?: Date } = {};

    if (dateFrom) {
      range.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      range.$lte = new Date(dateTo);
    }

    return range.$gte || range.$lte ? range : undefined;
  }

  private buildFilterContext(
    filters: EventQueryFiltersDto,
    campaignId?: string,
  ): Record<string, unknown> {
    return {
      campaignId: campaignId ?? filters.campaignId ?? null,
      contactId: filters.contactId ?? null,
      senderId: filters.senderId ?? null,
      channel: filters.channel ?? null,
      eventType: filters.eventType ?? [],
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
    };
  }

  private optionalObjectId(id: string | undefined, code: string): Types.ObjectId | null {
    if (!id) {
      return null;
    }

    return this.toObjectId(id, code);
  }

  private toObjectId(id: string, code: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppException(HttpStatus.BAD_REQUEST, code, 'Invalid ObjectId');
    }

    return new Types.ObjectId(id);
  }

  private safeDivide(numerator: number, denominator: number): number {
    if (!denominator) {
      return 0;
    }

    return Number((numerator / denominator).toFixed(4));
  }

  private toPercent(value: number): number {
    return Number((value * 100).toFixed(2));
  }

  private maxDate(...dates: Array<Date | null | undefined>): Date | null {
    let max: Date | null = null;

    for (const date of dates) {
      if (!date) {
        continue;
      }

      if (!max || date > max) {
        max = date;
      }
    }

    return max;
  }

  private async resolveWorkspaceId(authUser: AuthUser): Promise<string> {
    if (!authUser.workspaceId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WORKSPACE_CONTEXT_REQUIRED',
        'workspaceId is required in the authenticated context',
      );
    }

    if (!Types.ObjectId.isValid(authUser.workspaceId)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_WORKSPACE_ID', 'Invalid workspaceId');
    }

    const workspace = await this.workspacesService.findById(authUser.workspaceId);
    if (!workspace) {
      throw new AppException(HttpStatus.NOT_FOUND, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }

    return authUser.workspaceId;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
