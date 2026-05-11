import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import {
  CampaignChannel,
  CampaignRecipientStatus,
  CampaignStatus,
} from '../campaigns/constants/campaign.enums';
import {
  CampaignRecipient,
  CampaignRecipientDocument,
} from '../campaigns/schemas/campaign-recipient.schema';
import { Campaign, CampaignDocument } from '../campaigns/schemas/campaign.schema';
import {
  ContactSubscriptionStatus,
  ContactWhatsappStatus,
} from '../contacts/constants/contact.enums';
import { Contact, ContactDocument } from '../contacts/schemas/contact.schema';
import { EmailFailureCategory, EmailSendEventType } from '../email/constants/email.enums';
import { SendEvent } from '../email/schemas/send-event.schema';
import {
  SenderAccountStatus,
  SenderChannelType,
} from '../sender-accounts/constants/sender-account.enums';
import {
  SenderAccount,
  SenderAccountDocument,
} from '../sender-accounts/schemas/sender-account.schema';
import { SenderAccountSecretsService } from '../sender-accounts/sender-account-secrets.service';
import { SuppressionChannel } from '../suppression/constants/suppression.enums';
import { SuppressionService } from '../suppression/suppression.service';
import { TemplateChannelType } from '../templates/constants/template.enums';
import { Template, TemplateDocument } from '../templates/schemas/template.schema';
import { WhatsappErrorCode } from './constants/whatsapp.enums';
import { classifyWhatsappApiFailure } from './whatsapp-failure.utils';
import { renderWhatsappTemplateParameters } from './whatsapp-template.utils';

export interface WhatsappSendWorkerInput {
  campaignId: string;
  campaignRecipientId: string;
  senderAccountId: string;
  contactId: string;
}

export type WhatsappSendProcessOutcome =
  | { type: 'success' }
  | { type: 'retryable_failure'; message: string }
  | { type: 'permanent_failure'; message: string }
  | { type: 'suppressed' }
  | { type: 'not_opted_in' }
  | { type: 'noop' };

export interface WhatsappSendAttemptContext {
  attempt: number;
  maxAttempts: number;
}

interface WhatsappSendContext {
  workspaceId: Types.ObjectId;
  campaign: CampaignDocument;
  recipient: CampaignRecipientDocument;
  senderAccount: SenderAccountDocument;
  template: TemplateDocument;
  contact: ContactDocument;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly metaApiVersion = 'v20.0';

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<Campaign>,
    @InjectModel(CampaignRecipient.name)
    private readonly campaignRecipientModel: Model<CampaignRecipient>,
    @InjectModel(SenderAccount.name)
    private readonly senderAccountModel: Model<SenderAccount>,
    @InjectModel(Template.name)
    private readonly templateModel: Model<Template>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<Contact>,
    @InjectModel(SendEvent.name)
    private readonly sendEventModel: Model<SendEvent>,
    private readonly senderAccountSecretsService: SenderAccountSecretsService,
    private readonly suppressionService: SuppressionService,
  ) {}

  health(): { module: string; status: string; next: string } {
    return {
      module: 'whatsapp',
      status: 'ready',
      next: 'WhatsApp send worker engine is active.',
    };
  }

  async processSendJob(
    input: WhatsappSendWorkerInput,
    ctx: WhatsappSendAttemptContext,
  ): Promise<WhatsappSendProcessOutcome> {
    const context = await this.loadContext(input);

    if (
      context.campaign.status === CampaignStatus.CANCELLED ||
      context.campaign.status === CampaignStatus.COMPLETED
    ) {
      await this.recordSendEvent({
        context,
        eventType: EmailSendEventType.SEND_FAILED_PERMANENT,
        failureCategory: EmailFailureCategory.PERMANENT,
        failureCode: WhatsappErrorCode.API_FAILURE,
        failureMessage: 'Campaign is not in sendable state',
        attempt: ctx.attempt,
        maxAttempts: ctx.maxAttempts,
      });
      return { type: 'noop' };
    }

    if (
      context.recipient.status === CampaignRecipientStatus.SENT ||
      context.recipient.status === CampaignRecipientStatus.CANCELLED
    ) {
      return { type: 'noop' };
    }

    await this.recordSendEvent({
      context,
      eventType: EmailSendEventType.SEND_ATTEMPT,
      attempt: ctx.attempt,
      maxAttempts: ctx.maxAttempts,
    });

    const suppression = await this.suppressionService.checkSuppression(
      context.workspaceId.toString(),
      SuppressionChannel.WHATSAPP,
      {
        contactId: context.contact._id.toString(),
        phone: context.contact.phone ?? null,
      },
    );

    if (suppression.suppressed) {
      await this.markRecipientSkipped(context, 'Suppressed recipient');
      await this.recordSendEvent({
        context,
        eventType: EmailSendEventType.SEND_SKIPPED_SUPPRESSED,
        failureCategory: EmailFailureCategory.PERMANENT,
        failureCode: WhatsappErrorCode.CONTACT_SUPPRESSED,
        failureMessage: 'Contact is in suppression list for WhatsApp',
        attempt: ctx.attempt,
        maxAttempts: ctx.maxAttempts,
      });
      return { type: 'suppressed' };
    }

    if (!this.isContactOptedIn(context.contact)) {
      await this.markRecipientSkipped(context, 'Contact not opted-in for WhatsApp');
      await this.recordSendEvent({
        context,
        eventType: EmailSendEventType.SEND_FAILED_PERMANENT,
        failureCategory: EmailFailureCategory.PERMANENT,
        failureCode: WhatsappErrorCode.CONTACT_NOT_OPTED_IN,
        failureMessage: 'Contact is not opted in for WhatsApp sends',
        attempt: ctx.attempt,
        maxAttempts: ctx.maxAttempts,
      });
      return { type: 'not_opted_in' };
    }

    await this.campaignRecipientModel
      .updateOne(
        { _id: context.recipient._id },
        {
          $set: {
            status: CampaignRecipientStatus.SENDING,
            failureReason: '',
            lastAttemptAt: new Date(),
          },
        },
      )
      .exec();

    try {
      const payload = this.buildMetaTemplatePayload(context);
      const token = this.decryptSenderAccessToken(context.senderAccount);
      const phoneNumberId = context.senderAccount.whatsapp?.phoneNumberId;
      if (!phoneNumberId) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'WHATSAPP_PHONE_NUMBER_ID_MISSING',
          'Sender account phoneNumberId is missing',
        );
      }

      const endpoint = `https://graph.facebook.com/${this.metaApiVersion}/${encodeURIComponent(
        phoneNumberId,
      )}/messages`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json().catch(() => null)) as {
        messages?: Array<{ id?: string }>;
      } | null;

      if (!response.ok) {
        const failure = classifyWhatsappApiFailure({
          httpStatus: response.status,
          payload: responsePayload,
        });

        return this.handleFailure({
          context,
          failure,
          attempt: ctx.attempt,
          maxAttempts: ctx.maxAttempts,
          retriesRemaining: ctx.attempt < ctx.maxAttempts,
          metadata: {
            endpoint,
            payload,
            response: responsePayload,
          },
        });
      }

      const providerMessageId = responsePayload?.messages?.[0]?.id ?? null;

      await this.campaignRecipientModel
        .updateOne(
          { _id: context.recipient._id },
          {
            $set: {
              status: CampaignRecipientStatus.SENT,
              sentAt: new Date(),
              providerMessageId,
              failedAt: null,
              failureReason: '',
            },
          },
        )
        .exec();

      await this.campaignModel
        .updateOne(
          { _id: context.campaign._id },
          {
            $inc: {
              'stats.sentRecipients': 1,
              'stats.queuedRecipients': -1,
            },
          },
        )
        .exec();

      await this.tryMarkCampaignCompleted(context.campaign._id);

      await this.recordSendEvent({
        context,
        eventType: EmailSendEventType.SEND_SUCCESS,
        providerMessageId,
        attempt: ctx.attempt,
        maxAttempts: ctx.maxAttempts,
        metadata: {
          response: responsePayload,
        },
      });

      return { type: 'success' };
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      const fallbackFailure = classifyWhatsappApiFailure({
        httpStatus: 500,
        payload: {
          error: {
            message: error instanceof Error ? error.message : 'Unknown WhatsApp API failure',
          },
        },
      });

      return this.handleFailure({
        context,
        failure: fallbackFailure,
        attempt: ctx.attempt,
        maxAttempts: ctx.maxAttempts,
        retriesRemaining: ctx.attempt < ctx.maxAttempts,
      });
    }
  }

  async markJobAsFailedForNonRetryableError(
    input: WhatsappSendWorkerInput,
    reason: string,
  ): Promise<void> {
    let campaignId: Types.ObjectId;
    let campaignRecipientId: Types.ObjectId;
    let senderAccountId: Types.ObjectId;
    let contactId: Types.ObjectId;

    try {
      campaignId = this.toObjectId(input.campaignId, 'INVALID_CAMPAIGN_ID');
      campaignRecipientId = this.toObjectId(
        input.campaignRecipientId,
        'INVALID_CAMPAIGN_RECIPIENT_ID',
      );
      senderAccountId = this.toObjectId(input.senderAccountId, 'INVALID_SENDER_ACCOUNT_ID');
      contactId = this.toObjectId(input.contactId, 'INVALID_CONTACT_ID');
    } catch {
      return;
    }

    const failureReason = `SEND_ABORTED: ${reason}`.slice(0, 500);
    const updateResult = await this.campaignRecipientModel
      .updateOne(
        {
          _id: campaignRecipientId,
          campaignId,
          senderAccountId,
          contactId,
          status: {
            $in: [
              CampaignRecipientStatus.PENDING,
              CampaignRecipientStatus.QUEUED,
              CampaignRecipientStatus.SENDING,
            ],
          },
        },
        {
          $set: {
            status: CampaignRecipientStatus.FAILED,
            providerMessageId: null,
            failureReason,
            failedAt: new Date(),
          },
        },
      )
      .exec();

    if (!updateResult.modifiedCount) {
      return;
    }

    await this.campaignModel
      .updateOne(
        { _id: campaignId },
        {
          $inc: {
            'stats.failedRecipients': 1,
            'stats.queuedRecipients': -1,
          },
        },
      )
      .exec();

    await this.tryMarkCampaignCompleted(campaignId);
  }

  private async handleFailure(input: {
    context: WhatsappSendContext;
    failure: ReturnType<typeof classifyWhatsappApiFailure>;
    attempt: number;
    maxAttempts: number;
    retriesRemaining: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<WhatsappSendProcessOutcome> {
    const isTemporary = input.failure.category === EmailFailureCategory.TEMPORARY;

    if (isTemporary && input.retriesRemaining) {
      await this.campaignRecipientModel
        .updateOne(
          { _id: input.context.recipient._id },
          {
            $set: {
              status: CampaignRecipientStatus.QUEUED,
              providerMessageId: null,
              failureReason: `${input.failure.code}: ${input.failure.message}`,
              failedAt: null,
            },
          },
        )
        .exec();

      await this.recordSendEvent({
        context: input.context,
        eventType: EmailSendEventType.SEND_RETRY_SCHEDULED,
        failureCategory: input.failure.category,
        failureCode: input.failure.code,
        failureMessage: input.failure.message,
        smtpResponseCode: input.failure.providerStatusCode,
        attempt: input.attempt,
        maxAttempts: input.maxAttempts,
        retryScheduled: true,
        metadata: input.metadata,
      });

      return {
        type: 'retryable_failure',
        message: `${input.failure.code}: ${input.failure.message}`,
      };
    }

    await this.campaignRecipientModel
      .updateOne(
        { _id: input.context.recipient._id },
        {
          $set: {
            status: CampaignRecipientStatus.FAILED,
            providerMessageId: null,
            failureReason: `${input.failure.code}: ${input.failure.message}`,
            failedAt: new Date(),
          },
        },
      )
      .exec();

    await this.campaignModel
      .updateOne(
        { _id: input.context.campaign._id },
        {
          $inc: {
            'stats.failedRecipients': 1,
            'stats.queuedRecipients': -1,
          },
        },
      )
      .exec();

    await this.tryMarkCampaignCompleted(input.context.campaign._id);

    await this.recordSendEvent({
      context: input.context,
      eventType: isTemporary
        ? EmailSendEventType.SEND_FAILED_TEMPORARY
        : EmailSendEventType.SEND_FAILED_PERMANENT,
      failureCategory: input.failure.category,
      failureCode: input.failure.code,
      failureMessage: input.failure.message,
      smtpResponseCode: input.failure.providerStatusCode,
      attempt: input.attempt,
      maxAttempts: input.maxAttempts,
      metadata: input.metadata,
    });

    this.logger.warn(
      `WhatsApp send failed campaignRecipient=${input.context.recipient._id.toString()} category=${input.failure.category} code=${input.failure.code}`,
    );

    return {
      type: 'permanent_failure',
      message: `${input.failure.code}: ${input.failure.message}`,
    };
  }

  private async loadContext(input: WhatsappSendWorkerInput): Promise<WhatsappSendContext> {
    const campaignId = this.toObjectId(input.campaignId, 'INVALID_CAMPAIGN_ID');
    const campaignRecipientId = this.toObjectId(
      input.campaignRecipientId,
      'INVALID_CAMPAIGN_RECIPIENT_ID',
    );
    const senderAccountId = this.toObjectId(input.senderAccountId, 'INVALID_SENDER_ACCOUNT_ID');
    const contactId = this.toObjectId(input.contactId, 'INVALID_CONTACT_ID');

    const recipient = await this.campaignRecipientModel.findById(campaignRecipientId).exec();
    if (!recipient) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'CAMPAIGN_RECIPIENT_NOT_FOUND',
        'Campaign recipient not found',
      );
    }

    if (recipient.campaignId.toString() !== campaignId.toString()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAMPAIGN_RECIPIENT_CAMPAIGN_MISMATCH',
        'Campaign recipient does not belong to campaign',
      );
    }

    if (recipient.senderAccountId.toString() !== senderAccountId.toString()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAMPAIGN_RECIPIENT_SENDER_MISMATCH',
        'Campaign recipient sender mismatch',
      );
    }

    if (recipient.contactId.toString() !== contactId.toString()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAMPAIGN_RECIPIENT_CONTACT_MISMATCH',
        'Campaign recipient contact mismatch',
      );
    }

    const campaign = await this.campaignModel.findById(campaignId).exec();
    if (!campaign) {
      throw new AppException(HttpStatus.NOT_FOUND, 'CAMPAIGN_NOT_FOUND', 'Campaign not found');
    }

    if (campaign.channel !== CampaignChannel.WHATSAPP) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAMPAIGN_CHANNEL_NOT_WHATSAPP',
        'WhatsApp worker received non-WhatsApp campaign',
      );
    }

    const senderAccount = await this.senderAccountModel
      .findOne({
        _id: senderAccountId,
        workspaceId: campaign.workspaceId,
        channelType: SenderChannelType.WHATSAPP,
      })
      .select('+secrets.accessTokenEncrypted')
      .exec();

    if (!senderAccount || !senderAccount.whatsapp || !senderAccount.secrets?.accessTokenEncrypted) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_SENDER_CONFIG_INVALID',
        'WhatsApp sender account configuration is missing',
      );
    }

    if (senderAccount.status !== SenderAccountStatus.ACTIVE) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_SENDER_INACTIVE',
        'WhatsApp sender account is not active',
      );
    }

    const template = await this.templateModel
      .findOne({
        _id: campaign.templateId,
        workspaceId: campaign.workspaceId,
        channelType: TemplateChannelType.WHATSAPP,
      })
      .exec();

    if (!template || !template.whatsapp) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_TEMPLATE_NOT_FOUND',
        'WhatsApp template not found for campaign',
      );
    }

    const contact = await this.contactModel
      .findOne({
        _id: contactId,
        workspaceId: campaign.workspaceId,
      })
      .exec();

    if (!contact || !contact.phone) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_CONTACT_INVALID',
        'Contact is missing a valid phone number',
      );
    }

    return {
      workspaceId: campaign.workspaceId,
      campaign,
      recipient,
      senderAccount,
      template,
      contact,
    };
  }

  private buildMetaTemplatePayload(context: WhatsappSendContext): Record<string, unknown> {
    const template = context.template.whatsapp;
    if (!template) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_TEMPLATE_CONTENT_MISSING',
        'WhatsApp template content is missing',
      );
    }

    const normalizedPhone = this.normalizePhoneForMeta(context.contact.phone ?? '');
    if (!normalizedPhone) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_PHONE_INVALID',
        'Contact phone is invalid for WhatsApp send',
      );
    }

    const contactData = {
      firstName: context.contact.firstName,
      lastName: context.contact.lastName,
      fullName: context.contact.fullName,
      email: context.contact.email,
      phone: context.contact.phone,
      company: context.contact.company,
      category: context.contact.category,
      labels: context.contact.labels,
      customFields: context.contact.customFields,
      campaign: {
        id: context.campaign._id.toString(),
        name: context.campaign.name,
      },
    } as Record<string, unknown>;

    const rendered = renderWhatsappTemplateParameters({
      templateName: template.templateName,
      language: template.language,
      bodyParams: template.bodyParams ?? [],
      headerParams: template.headerParams ?? [],
      buttonParams: template.buttonParams ?? [],
      context: contactData,
    });

    const components: Array<Record<string, unknown>> = [];

    if (rendered.headerParams.length) {
      components.push({
        type: 'header',
        parameters: rendered.headerParams.map((value) => ({
          type: 'text',
          text: value,
        })),
      });
    }

    if (rendered.bodyParams.length) {
      components.push({
        type: 'body',
        parameters: rendered.bodyParams.map((value) => ({
          type: 'text',
          text: value,
        })),
      });
    }

    if (rendered.buttonParams.length) {
      rendered.buttonParams.forEach((value, index) => {
        components.push({
          type: 'button',
          sub_type: 'quick_reply',
          index: String(index),
          parameters: [
            {
              type: 'payload',
              payload: value,
            },
          ],
        });
      });
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'template',
      template: {
        name: rendered.templateName,
        language: {
          code: rendered.language,
        },
        ...(components.length ? { components } : {}),
      },
    };
  }

  private decryptSenderAccessToken(senderAccount: SenderAccountDocument): string {
    const encrypted = senderAccount.secrets.accessTokenEncrypted;
    if (!encrypted) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_ACCESS_TOKEN_MISSING',
        'WhatsApp sender access token is missing',
      );
    }

    return this.senderAccountSecretsService.decrypt(encrypted);
  }

  private async markRecipientSkipped(context: WhatsappSendContext, reason: string): Promise<void> {
    await this.campaignRecipientModel
      .updateOne(
        { _id: context.recipient._id },
        {
          $set: {
            status: CampaignRecipientStatus.SKIPPED,
            providerMessageId: null,
            failureReason: reason,
            failedAt: null,
          },
        },
      )
      .exec();

    await this.campaignModel
      .updateOne(
        { _id: context.campaign._id },
        {
          $inc: {
            'stats.skippedRecipients': 1,
            'stats.queuedRecipients': -1,
          },
        },
      )
      .exec();

    await this.tryMarkCampaignCompleted(context.campaign._id);
  }

  /**
   * Atomically flip a RUNNING campaign to COMPLETED once queuedRecipients
   * reaches zero. The condition prevents multiple concurrent workers from
   * marking it completed more than once.
   */
  private async tryMarkCampaignCompleted(campaignId: Types.ObjectId): Promise<void> {
    await this.campaignModel
      .updateOne(
        {
          _id: campaignId,
          status: CampaignStatus.RUNNING,
          'stats.queuedRecipients': { $lte: 0 },
        },
        {
          $set: {
            status: CampaignStatus.COMPLETED,
          },
        },
      )
      .exec();
  }

  private isContactOptedIn(contact: ContactDocument): boolean {
    if (!contact.phone?.trim()) {
      return false;
    }

    if (contact.whatsappStatus === ContactWhatsappStatus.OPTED_OUT) {
      return false;
    }

    if (contact.whatsappStatus === ContactWhatsappStatus.INVALID) {
      return false;
    }

    if (
      contact.subscriptionStatus === ContactSubscriptionStatus.UNSUBSCRIBED ||
      contact.subscriptionStatus === ContactSubscriptionStatus.SUPPRESSED
    ) {
      return false;
    }

    return true;
  }

  private async recordSendEvent(input: {
    context: WhatsappSendContext;
    eventType: EmailSendEventType;
    failureCategory?: EmailFailureCategory;
    failureCode?: string;
    failureMessage?: string;
    smtpResponseCode?: number | null;
    providerMessageId?: string | null;
    attempt: number;
    maxAttempts: number;
    retryScheduled?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.sendEventModel.create({
      workspaceId: input.context.workspaceId,
      campaignId: input.context.campaign._id,
      campaignRecipientId: input.context.recipient._id,
      senderAccountId: input.context.senderAccount._id,
      contactId: input.context.contact._id,
      channel: CampaignChannel.WHATSAPP,
      address: input.context.recipient.address,
      eventType: input.eventType,
      failureCategory: input.failureCategory ?? null,
      failureCode: input.failureCode ?? '',
      failureMessage: input.failureMessage ?? '',
      smtpResponseCode: input.smtpResponseCode ?? null,
      providerMessageId: input.providerMessageId ?? null,
      attempt: input.attempt,
      maxAttempts: input.maxAttempts,
      retryScheduled: input.retryScheduled ?? false,
      hardBounceCandidate: false,
      metadata: input.metadata ?? {},
    });
  }

  private normalizePhoneForMeta(phone: string): string {
    const normalized = phone.trim().replace(/[^\d]/g, '');
    return normalized;
  }

  private toObjectId(id: string, code: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppException(HttpStatus.BAD_REQUEST, code, 'Invalid ObjectId');
    }

    return new Types.ObjectId(id);
  }
}
