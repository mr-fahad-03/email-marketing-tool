import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Model, Types } from 'mongoose';
import { AppException } from '../../../common/exceptions/app.exception';
import {
  CampaignDistributionStrategy,
  CampaignRecipientStatus,
  CampaignStatus,
} from '../../campaigns/constants/campaign.enums';
import {
  DistributionRecipientInput,
  DistributionSenderInput,
  distributeRecipients,
  normalizeSenderCapacities,
} from '../../campaigns/campaign-distribution.utils';
import { CampaignRecipient } from '../../campaigns/schemas/campaign-recipient.schema';
import { Campaign } from '../../campaigns/schemas/campaign.schema';
import { Contact } from '../../contacts/schemas/contact.schema';
import { SegmentType } from '../../segments/constants/segment.enums';
import { Segment, SegmentFilters } from '../../segments/schemas/segment.schema';
import {
  SenderAccountStatus,
  SenderChannelType,
} from '../../sender-accounts/constants/sender-account.enums';
import { SenderAccount } from '../../sender-accounts/schemas/sender-account.schema';
import {
  QUEUE_CONCURRENCY,
  QUEUE_NAMES,
  QUEUE_WORKER_SKIP_VERSION_CHECK,
  QUEUE_WORKER_SKIP_WAITING_FOR_READY,
} from '../queue.constants';
import { QueueService } from '../queue.service';

interface CampaignSchedulerPayload {
  campaignId: string;
  workspaceId: string;
}

@Injectable()
@Processor(QUEUE_NAMES.CAMPAIGN_SCHEDULER, {
  concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.CAMPAIGN_SCHEDULER],
  skipVersionCheck: QUEUE_WORKER_SKIP_VERSION_CHECK,
  skipWaitingForReady: QUEUE_WORKER_SKIP_WAITING_FOR_READY,
})
export class CampaignSchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignSchedulerProcessor.name);

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<Campaign>,
    @InjectModel(CampaignRecipient.name)
    private readonly campaignRecipientModel: Model<CampaignRecipient>,
    @InjectModel(SenderAccount.name)
    private readonly senderAccountModel: Model<SenderAccount>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<Contact>,
    @InjectModel(Segment.name)
    private readonly segmentModel: Model<Segment>,
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<CampaignSchedulerPayload>): Promise<void> {
    const payload = job.data;
    if (!payload?.campaignId || !payload?.workspaceId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_CAMPAIGN_SCHEDULER_JOB',
        'campaignId and workspaceId are required',
      );
    }

    const workspaceId = this.toObjectId(payload.workspaceId);
    const campaignId = this.toObjectId(payload.campaignId);

    const campaign = await this.campaignModel
      .findOne({
        _id: campaignId,
        workspaceId,
      })
      .exec();

    if (!campaign) {
      this.logger.warn(`Campaign not found for scheduler job id=${job.id}`);
      return;
    }

    if (
      campaign.status !== CampaignStatus.RUNNING &&
      campaign.status !== CampaignStatus.SCHEDULED
    ) {
      this.logger.warn(
        `Skipping scheduler for campaign=${campaign.id} status=${campaign.status} job=${job.id}`,
      );
      return;
    }

    if (
      campaign.status === CampaignStatus.SCHEDULED &&
      campaign.startAt &&
      campaign.startAt.getTime() > Date.now()
    ) {
      const delay = Math.max(0, campaign.startAt.getTime() - Date.now());
      await this.queueService.enqueueCampaignScheduler(
        {
          campaignId: campaign.id,
          workspaceId: campaign.workspaceId.toString(),
        },
        { delay },
      );
      return;
    }

    const recipients = await this.resolveAudienceRecipients(campaign);
    if (!recipients.length) {
      campaign.stats.queuedRecipients = 0;
      campaign.status = CampaignStatus.COMPLETED;
      await campaign.save();
      return;
    }

    const senderInputs = await this.resolveEligibleSenderCapacityInputs(campaign);
    const normalizedSenders = normalizeSenderCapacities(senderInputs);
    if (!normalizedSenders.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'NO_ACTIVE_SENDERS_WITH_CAPACITY',
        'No active sender accounts with capacity for campaign scheduling',
      );
    }

    const strategy =
      campaign.settings?.distributionStrategy ?? CampaignDistributionStrategy.ROUND_ROBIN;

    const distribution = distributeRecipients({
      strategy,
      senders: normalizedSenders,
      recipients,
    });

    if (distribution.assignments.length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'RECIPIENT_ASSIGNMENT_FAILED',
        'No recipients could be assigned to sender accounts',
      );
    }

    const now = new Date();
    const recipientWrites = distribution.assignments.map((assignment) => ({
      updateOne: {
        filter: {
          campaignId,
          contactId: this.toObjectId(assignment.contactId),
          channel: campaign.channel,
        },
        update: {
          $set: {
            workspaceId,
            campaignId,
            contactId: this.toObjectId(assignment.contactId),
            channel: campaign.channel,
            address: assignment.address,
            senderAccountId: this.toObjectId(assignment.senderAccountId),
            templateId: campaign.templateId,
            status: CampaignRecipientStatus.QUEUED,
            failureReason: '',
            queuedAt: now,
            sentAt: null,
            providerMessageId: null,
            failedAt: null,
            lastAttemptAt: null,
          },
        },
        upsert: true,
      },
    }));

    if (recipientWrites.length) {
      await this.campaignRecipientModel.bulkWrite(recipientWrites);
    }

    const assignedContactIds = distribution.assignments.map((assignment) =>
      this.toObjectId(assignment.contactId),
    );

    const persistedRecipients = await this.campaignRecipientModel
      .find({
        campaignId,
        channel: campaign.channel,
        contactId: { $in: assignedContactIds },
      })
      .select('_id contactId senderAccountId')
      .lean()
      .exec();

    const recipientByContactId = new Map<string, { id: string; senderAccountId: string }>();
    for (const persisted of persistedRecipients) {
      recipientByContactId.set(String(persisted.contactId), {
        id: String(persisted._id),
        senderAccountId: String(persisted.senderAccountId),
      });
    }

    const enqueueResults = await Promise.all(
      distribution.assignments.map((assignment) => {
        const recipient = recipientByContactId.get(assignment.contactId);
        if (!recipient) {
          throw new AppException(
            HttpStatus.INTERNAL_SERVER_ERROR,
            'CAMPAIGN_RECIPIENT_ASSIGNMENT_MISSING',
            'Campaign recipient assignment could not be persisted',
          );
        }

        const payloadBase = {
          campaignId: campaign.id,
          campaignRecipientId: recipient.id,
          senderAccountId: recipient.senderAccountId,
          contactId: assignment.contactId,
        };

        if (campaign.channel === 'email') {
          return this.queueService.enqueueEmailSend(payloadBase);
        }

        return this.queueService.enqueueWhatsappSend(payloadBase);
      }),
    );

    campaign.status = CampaignStatus.RUNNING;
    campaign.stats.totalRecipients = campaign.stats.totalRecipients || recipients.length;
    campaign.stats.queuedRecipients = distribution.assignments.length;
    campaign.stats.skippedRecipients = distribution.remainingRecipientCount;
    campaign.stats.lastStartedAt = campaign.stats.lastStartedAt ?? now;
    await campaign.save();

    this.logger.log(
      `Scheduler created ${enqueueResults.length} send jobs for campaign=${campaign.id} with strategy=${strategy}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CampaignSchedulerPayload>, error: Error): void {
    this.logger.error(
      `Campaign scheduler job failed id=${job.id} name=${job.name}: ${error.message}`,
      error.stack,
    );
  }

  private async resolveEligibleSenderCapacityInputs(
    campaign: Campaign,
  ): Promise<DistributionSenderInput[]> {
    const channelType =
      campaign.channel === 'email' ? SenderChannelType.EMAIL : SenderChannelType.WHATSAPP;

    const senders = await this.senderAccountModel
      .find({
        workspaceId: campaign.workspaceId,
        _id: { $in: campaign.senderAccountIds },
        channelType,
        status: SenderAccountStatus.ACTIVE,
      })
      .select('_id email')
      .lean()
      .exec();

    return senders.map((sender) => ({
      senderAccountId: String(sender._id),
      dailyLimit: sender.email?.dailyLimit ?? campaign.dailyCap ?? Number.MAX_SAFE_INTEGER,
      hourlyLimit: sender.email?.hourlyLimit ?? campaign.dailyCap ?? Number.MAX_SAFE_INTEGER,
    }));
  }

  private async resolveAudienceRecipients(
    campaign: Campaign,
  ): Promise<DistributionRecipientInput[]> {
    const contactIdSet = new Set<string>(campaign.contactIds.map((id) => String(id)));

    if (campaign.segmentId) {
      const segment = await this.segmentModel
        .findOne({
          _id: campaign.segmentId,
          workspaceId: campaign.workspaceId,
        })
        .lean()
        .exec();

      if (segment) {
        if (segment.type === SegmentType.STATIC) {
          for (const segmentContactId of segment.contactIds ?? []) {
            contactIdSet.add(String(segmentContactId));
          }
        } else {
          const dynamicContactIds = await this.findDynamicSegmentContactIds(
            campaign.workspaceId as Types.ObjectId,
            segment.filters as SegmentFilters,
          );
          for (const dynamicId of dynamicContactIds) {
            contactIdSet.add(dynamicId);
          }
        }
      }
    }

    if (!contactIdSet.size) {
      return [];
    }

        const contacts = await this.contactModel
      .find({
        workspaceId: campaign.workspaceId,
        _id: { $in: Array.from(contactIdSet).map((id) => this.toObjectId(id)) },
      })
      .select('_id email phone')
      .lean()
      .exec();

        const existingRecipients = await this.campaignRecipientModel
      .find({
        campaignId: (campaign as any)._id,
        status: {
          $in: [
            CampaignRecipientStatus.SENT,
            CampaignRecipientStatus.FAILED,
            CampaignRecipientStatus.SKIPPED,
            CampaignRecipientStatus.CANCELLED,
          ],
        },
      })
      .select('contactId')
      .lean()
      .exec();

    const excludedContactIds = new Set(existingRecipients.map((r) => String(r.contactId)));

    const recipients: DistributionRecipientInput[] = [];

    for (const contact of contacts) {
      if (excludedContactIds.has(String(contact._id))) {
        continue;
      }

      const address =
        campaign.channel === 'email'
          ? (contact.email ?? '').trim().toLowerCase()
          : this.normalizePhone(contact.phone ?? '');

      if (!address) {
        continue;
      }

      recipients.push({
        contactId: String(contact._id),
        address,
      });
    }

    return recipients;
  }

  private async findDynamicSegmentContactIds(
    workspaceId: Types.ObjectId,
    filters: SegmentFilters | undefined,
  ): Promise<string[]> {
    const query: Record<string, unknown> = { workspaceId };
    const tags = (filters?.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    if (tags.length) {
      query.tags = { $all: tags };
    }
    if (filters?.subscriptionStatus) {
      query.subscriptionStatus = filters.subscriptionStatus;
    }
    if (filters?.emailStatus) {
      query.emailStatus = filters.emailStatus;
    }
    if (filters?.whatsappStatus) {
      query.whatsappStatus = filters.whatsappStatus;
    }

    const contacts = await this.contactModel.find(query).select('_id').lean().exec();
    return contacts.map((contact) => String(contact._id));
  }

  private normalizePhone(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    let normalized = trimmed.replace(/[^\d+]/g, '');
    if (normalized.startsWith('+')) {
      normalized = `+${normalized.slice(1).replace(/\+/g, '')}`;
    } else {
      normalized = normalized.replace(/\+/g, '');
    }

    return normalized;
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_ID', 'Invalid ObjectId');
    }

    return new Types.ObjectId(id);
  }
}
