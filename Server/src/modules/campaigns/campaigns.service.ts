import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthUser } from '../../common/types/auth-user.type';
import { Contact, ContactDocument } from '../contacts/schemas/contact.schema';
import { QueueService } from '../queue/queue.service';
import { SegmentType } from '../segments/constants/segment.enums';
import { Segment, SegmentFilters } from '../segments/schemas/segment.schema';
import {
  SenderAccountStatus,
  SenderChannelType,
} from '../sender-accounts/constants/sender-account.enums';
import { SenderAccount } from '../sender-accounts/schemas/sender-account.schema';
import { TemplateChannelType } from '../templates/constants/template.enums';
import { Template } from '../templates/schemas/template.schema';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CampaignDistributionService } from './campaign-distribution.service';
import {
  CampaignChannel,
  CampaignDistributionStrategy,
  CampaignStatus,
} from './constants/campaign.enums';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignAudienceDto } from './dto/list-campaign-audience.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Campaign, CampaignDocument } from './schemas/campaign.schema';
import { CampaignListResponse, CampaignResponse } from './types/campaign.response';
import { ContactListResponse, ContactResponse } from '../contacts/types/contact.response';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<Campaign>,
    @InjectModel(SenderAccount.name)
    private readonly senderAccountModel: Model<SenderAccount>,
    @InjectModel(Template.name)
    private readonly templateModel: Model<Template>,
    @InjectModel(Segment.name)
    private readonly segmentModel: Model<Segment>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<Contact>,
    private readonly workspacesService: WorkspacesService,
    private readonly queueService: QueueService,
    private readonly campaignDistributionService: CampaignDistributionService,
  ) {}

  async create(dto: CreateCampaignDto, authUser: AuthUser): Promise<CampaignResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    this.assertDelayRange(dto.randomDelayMinSeconds, dto.randomDelayMaxSeconds);

    const senderAccountIds = this.uniqueObjectIds(dto.senderAccountIds);
    const contactIds = this.uniqueObjectIds(dto.contactIds ?? []);
    const segmentId = dto.segmentId ? this.toObjectId(dto.segmentId, 'INVALID_SEGMENT_ID') : null;
    const templateId = this.toObjectId(dto.templateId, 'INVALID_TEMPLATE_ID');

    await this.validateSenderOwnership(workspaceId, dto.channel, senderAccountIds, false);
    await this.validateTemplateOwnership(workspaceId, dto.channel, templateId);
    await this.validateSegmentOwnership(workspaceId, segmentId);
    await this.validateContactsOwnership(workspaceId, contactIds);

    const created = await this.campaignModel.create({
      workspaceId: this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID'),
      name: dto.name.trim(),
      channel: dto.channel,
      senderAccountIds,
      segmentId,
      contactIds,
      templateId,
      status: dto.status ?? CampaignStatus.DRAFT,
      timezone: dto.timezone ?? 'UTC',
      startAt: dto.startAt ? new Date(dto.startAt) : null,
      sendingWindowStart: dto.sendingWindowStart ?? null,
      sendingWindowEnd: dto.sendingWindowEnd ?? null,
      dailyCap: dto.dailyCap ?? null,
      trackOpens: dto.trackOpens ?? true,
      trackClicks: dto.trackClicks ?? true,
      randomDelayMinSeconds: dto.randomDelayMinSeconds ?? 0,
      randomDelayMaxSeconds: dto.randomDelayMaxSeconds ?? 0,
      settings: {
        distributionStrategy:
          dto.settings?.distributionStrategy ?? CampaignDistributionStrategy.ROUND_ROBIN,
      },
      stats: {
        totalRecipients: 0,
        queuedRecipients: 0,
        skippedRecipients: 0,
        sentRecipients: 0,
        failedRecipients: 0,
        openCount: 0,
        uniqueOpenCount: 0,
        clickCount: 0,
        uniqueClickCount: 0,
        whatsappSentCount: 0,
        whatsappDeliveredCount: 0,
        whatsappReadCount: 0,
        whatsappFailedCount: 0,
        lastStartedAt: null,
        lastOpenedAt: null,
        lastClickedAt: null,
        lastWhatsappStatusAt: null,
      },
    });

    return this.toResponse(created);
  }

  async findAll(query: ListCampaignsDto, authUser: AuthUser): Promise<CampaignListResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      workspaceId: this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID'),
    };

    if (query.channel) {
      filter.channel = query.channel;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search?.trim()) {
      filter.name = new RegExp(this.escapeRegex(query.search.trim()), 'i');
    }

    const [items, total] = await Promise.all([
      this.campaignModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.campaignModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items: items.map((item) => this.toResponse(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async findOne(id: string, authUser: AuthUser): Promise<CampaignResponse> {
    const campaign = await this.findOwnedCampaign(id, authUser);
    return this.toResponse(campaign);
  }

  async findAudience(
    id: string,
    query: ListCampaignAudienceDto,
    authUser: AuthUser,
  ): Promise<ContactListResponse> {
    const campaign = await this.findOwnedCampaign(id, authUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const audienceContactIds = await this.resolveAudienceContactIds(campaign);
    if (!audienceContactIds.length) {
      return {
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      };
    }

    const sendabilityFilter =
      campaign.channel === CampaignChannel.EMAIL
        ? { email: { $nin: [null, ''] } }
        : { phone: { $nin: [null, ''] } };

    const filter = {
      workspaceId: campaign.workspaceId,
      _id: { $in: audienceContactIds },
      ...sendabilityFilter,
    };

    const [items, total] = await Promise.all([
      this.contactModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.contactModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items: items.map((item) => this.toContactResponse(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async update(id: string, dto: UpdateCampaignDto, authUser: AuthUser): Promise<CampaignResponse> {
    const campaign = await this.findOwnedCampaign(id, authUser);
    const workspaceId = campaign.workspaceId.toString();

    if (campaign.status === CampaignStatus.RUNNING) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAMPAIGN_RUNNING_UPDATE_NOT_ALLOWED',
        'Running campaign cannot be modified',
      );
    }

    if (dto.name !== undefined) {
      campaign.name = dto.name.trim();
    }

    if (dto.channel !== undefined) {
      campaign.channel = dto.channel;
    }

    if (dto.senderAccountIds !== undefined) {
      campaign.senderAccountIds = this.uniqueObjectIds(dto.senderAccountIds);
    }

    if (dto.segmentId !== undefined) {
      campaign.segmentId = dto.segmentId
        ? this.toObjectId(dto.segmentId, 'INVALID_SEGMENT_ID')
        : null;
    }

    if (dto.contactIds !== undefined) {
      campaign.contactIds = this.uniqueObjectIds(dto.contactIds);
    }

    if (dto.templateId !== undefined) {
      campaign.templateId = this.toObjectId(dto.templateId, 'INVALID_TEMPLATE_ID');
    }

    if (dto.timezone !== undefined) {
      campaign.timezone = dto.timezone;
    }

    if (dto.startAt !== undefined) {
      campaign.startAt = dto.startAt ? new Date(dto.startAt) : null;
    }

    if (dto.sendingWindowStart !== undefined) {
      campaign.sendingWindowStart = dto.sendingWindowStart ?? null;
    }

    if (dto.sendingWindowEnd !== undefined) {
      campaign.sendingWindowEnd = dto.sendingWindowEnd ?? null;
    }

    if (dto.dailyCap !== undefined) {
      campaign.dailyCap = dto.dailyCap ?? null;
    }

    if (dto.trackOpens !== undefined) {
      campaign.trackOpens = dto.trackOpens;
    }

    if (dto.trackClicks !== undefined) {
      campaign.trackClicks = dto.trackClicks;
    }

    if (dto.randomDelayMinSeconds !== undefined) {
      campaign.randomDelayMinSeconds = dto.randomDelayMinSeconds;
    }

    if (dto.randomDelayMaxSeconds !== undefined) {
      campaign.randomDelayMaxSeconds = dto.randomDelayMaxSeconds;
    }

    if (dto.settings?.distributionStrategy !== undefined) {
      campaign.settings.distributionStrategy = dto.settings.distributionStrategy;
    }

    this.assertDelayRange(campaign.randomDelayMinSeconds, campaign.randomDelayMaxSeconds);

    await this.validateSenderOwnership(
      workspaceId,
      campaign.channel,
      campaign.senderAccountIds,
      false,
    );
    await this.validateTemplateOwnership(workspaceId, campaign.channel, campaign.templateId);
    await this.validateSegmentOwnership(workspaceId, campaign.segmentId);
    await this.validateContactsOwnership(workspaceId, campaign.contactIds);

    const saved = await campaign.save();
    return this.toResponse(saved);
  }

  async start(id: string, authUser: AuthUser): Promise<CampaignResponse> {
    const campaign = await this.findOwnedCampaign(id, authUser);
    const workspaceId = campaign.workspaceId.toString();

    await this.validateTemplateOwnership(workspaceId, campaign.channel, campaign.templateId);
    await this.validateSegmentOwnership(workspaceId, campaign.segmentId);
    await this.validateContactsOwnership(workspaceId, campaign.contactIds);

    const recipients = await this.resolveAudienceRecipients(campaign);
    const eligibleSenders = await this.validateSenderOwnership(
      workspaceId,
      campaign.channel,
      campaign.senderAccountIds,
      true,
    );

    const senderCaps = eligibleSenders.map((sender) => ({
      senderAccountId: sender._id.toString(),
      dailyLimit: this.resolveSenderDailyLimit(sender, campaign.dailyCap),
      hourlyLimit: this.resolveSenderHourlyLimit(sender, campaign.dailyCap),
    }));

    this.campaignDistributionService.validateCampaignCanStart(
      campaign.status,
      recipients.length,
      senderCaps,
    );

    campaign.status = campaign.startAt ? CampaignStatus.SCHEDULED : CampaignStatus.RUNNING;
    campaign.stats.totalRecipients = recipients.length;
    campaign.stats.queuedRecipients = 0;
    campaign.stats.skippedRecipients = 0;
    campaign.stats.lastStartedAt = new Date();

    await campaign.save();

    const delayMs = campaign.startAt
      ? Math.max(0, campaign.startAt.getTime() - Date.now())
      : undefined;

    await this.queueService.enqueueCampaignScheduler(
      {
        campaignId: campaign.id,
        workspaceId,
      },
      delayMs ? { delay: delayMs } : undefined,
    );

    return this.toResponse(campaign);
  }

  async pause(id: string, authUser: AuthUser): Promise<CampaignResponse> {
    const campaign = await this.findOwnedCampaign(id, authUser);
    if (
      campaign.status !== CampaignStatus.RUNNING &&
      campaign.status !== CampaignStatus.SCHEDULED
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAMPAIGN_PAUSE_NOT_ALLOWED',
        'Only running or scheduled campaigns can be paused',
      );
    }

    campaign.status = CampaignStatus.PAUSED;
    await campaign.save();
    return this.toResponse(campaign);
  }

  async resume(id: string, authUser: AuthUser): Promise<CampaignResponse> {
    const campaign = await this.findOwnedCampaign(id, authUser);
    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAMPAIGN_RESUME_NOT_ALLOWED',
        'Only paused campaigns can be resumed',
      );
    }

    campaign.status = CampaignStatus.RUNNING;
    await campaign.save();

    await this.queueService.enqueueCampaignScheduler({
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId.toString(),
    });

    return this.toResponse(campaign);
  }

  async cancel(id: string, authUser: AuthUser): Promise<CampaignResponse> {
    const campaign = await this.findOwnedCampaign(id, authUser);

    if (
      campaign.status === CampaignStatus.COMPLETED ||
      campaign.status === CampaignStatus.CANCELLED
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAMPAIGN_CANCEL_NOT_ALLOWED',
        'Campaign is already completed or cancelled',
      );
    }

    campaign.status = CampaignStatus.CANCELLED;
    await campaign.save();
    return this.toResponse(campaign);
  }

  private async resolveAudienceRecipients(
    campaign: CampaignDocument,
  ): Promise<Array<{ contactId: string; address: string }>> {
    const audienceContactIds = await this.resolveAudienceContactIds(campaign);
    if (!audienceContactIds.length) {
      return [];
    }
    const contacts = await this.contactModel
      .find({
        workspaceId: campaign.workspaceId,
        _id: { $in: audienceContactIds },
      })
      .select('_id email phone')
      .lean()
      .exec();

    const recipients: Array<{ contactId: string; address: string }> = [];

    for (const contact of contacts) {
      const address =
        campaign.channel === CampaignChannel.EMAIL
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

  private async resolveAudienceContactIds(campaign: CampaignDocument): Promise<Types.ObjectId[]> {
    const contactIdSet = new Set<string>(campaign.contactIds.map((id) => id.toString()));

    if (campaign.segmentId) {
      const segment = await this.segmentModel
        .findOne({
          _id: campaign.segmentId,
          workspaceId: campaign.workspaceId,
        })
        .lean()
        .exec();

      if (!segment) {
        throw new AppException(HttpStatus.NOT_FOUND, 'SEGMENT_NOT_FOUND', 'Segment not found');
      }

      if (segment.type === SegmentType.STATIC) {
        for (const segmentContactId of segment.contactIds ?? []) {
          contactIdSet.add(String(segmentContactId));
        }
      } else {
        const dynamicContactIds = await this.findDynamicSegmentContactIds(
          campaign.workspaceId,
          segment.filters as SegmentFilters,
        );
        for (const dynamicId of dynamicContactIds) {
          contactIdSet.add(dynamicId);
        }
      }
    }

    return Array.from(contactIdSet).map((id) => this.toObjectId(id, 'INVALID_CONTACT_ID'));
  }

  private async findDynamicSegmentContactIds(
    workspaceId: Types.ObjectId,
    filters: SegmentFilters | undefined,
  ): Promise<string[]> {
    const query: Record<string, unknown> = { workspaceId };

    const normalizedTags = (filters?.tags ?? [])
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    if (normalizedTags.length) {
      query.tags = { $all: normalizedTags };
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

  private async findOwnedCampaign(id: string, authUser: AuthUser): Promise<CampaignDocument> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const campaign = await this.campaignModel
      .findOne({
        _id: this.toObjectId(id, 'INVALID_CAMPAIGN_ID'),
        workspaceId: this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID'),
      })
      .exec();

    if (!campaign) {
      throw new AppException(HttpStatus.NOT_FOUND, 'CAMPAIGN_NOT_FOUND', 'Campaign not found');
    }

    return campaign;
  }

  private async validateSenderOwnership(
    workspaceId: string,
    channel: CampaignChannel,
    senderIds: Types.ObjectId[],
    activeOnly: boolean,
  ): Promise<
    Array<{
      _id: Types.ObjectId;
      status: SenderAccountStatus;
      email?: { dailyLimit: number; hourlyLimit: number } | null;
    }>
  > {
    if (!senderIds.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'SENDER_ACCOUNTS_REQUIRED',
        'At least one sender account is required',
      );
    }

    const channelType =
      channel === CampaignChannel.EMAIL ? SenderChannelType.EMAIL : SenderChannelType.WHATSAPP;

    const senders = await this.senderAccountModel
      .find({
        workspaceId: this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID'),
        _id: { $in: senderIds },
        channelType,
      })
      .select('_id status email')
      .lean()
      .exec();

    const found = new Set(senders.map((sender) => String(sender._id)));
    const missing = senderIds.map((id) => String(id)).filter((id) => !found.has(id));

    if (missing.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'SENDER_ACCOUNTS_NOT_IN_WORKSPACE_OR_CHANNEL',
        'Some senderAccountIds are invalid for workspace/channel',
        { missing },
      );
    }

    const eligible = senders.filter((sender) => {
      if (!activeOnly) {
        return true;
      }

      return sender.status === SenderAccountStatus.ACTIVE;
    });

    if (activeOnly && !eligible.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'NO_ACTIVE_SENDERS',
        'No active sender accounts available for this campaign',
      );
    }

    return eligible.map((sender) => ({
      _id: sender._id as Types.ObjectId,
      status: sender.status as SenderAccountStatus,
      email: sender.email as { dailyLimit: number; hourlyLimit: number } | null,
    }));
  }

  private async validateTemplateOwnership(
    workspaceId: string,
    channel: CampaignChannel,
    templateId: Types.ObjectId,
  ): Promise<void> {
    const channelType =
      channel === CampaignChannel.EMAIL ? TemplateChannelType.EMAIL : TemplateChannelType.WHATSAPP;
    const template = await this.templateModel
      .findOne({
        _id: templateId,
        workspaceId: this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID'),
        channelType,
      })
      .select('_id')
      .lean()
      .exec();

    if (!template) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TEMPLATE_NOT_IN_WORKSPACE_OR_CHANNEL',
        'Template does not belong to workspace or campaign channel',
      );
    }
  }

  private async validateSegmentOwnership(
    workspaceId: string,
    segmentId: Types.ObjectId | null,
  ): Promise<void> {
    if (!segmentId) {
      return;
    }

    const segment = await this.segmentModel
      .findOne({
        _id: segmentId,
        workspaceId: this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID'),
      })
      .select('_id')
      .lean()
      .exec();

    if (!segment) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'SEGMENT_NOT_IN_WORKSPACE',
        'Segment does not belong to workspace',
      );
    }
  }

  private async validateContactsOwnership(
    workspaceId: string,
    contactIds: Types.ObjectId[],
  ): Promise<void> {
    if (!contactIds.length) {
      return;
    }

    const contacts = await this.contactModel
      .find({
        workspaceId: this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID'),
        _id: { $in: contactIds },
      })
      .select('_id')
      .lean()
      .exec();

    const found = new Set(contacts.map((contact) => String(contact._id)));
    const missing = contactIds.map((id) => String(id)).filter((id) => !found.has(id));

    if (missing.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CONTACTS_NOT_IN_WORKSPACE',
        'Some contactIds do not belong to workspace',
        { missing },
      );
    }
  }

  private resolveSenderDailyLimit(
    sender: { email?: { dailyLimit: number } | null },
    campaignDailyCap: number | null,
  ): number {
    const base = sender.email?.dailyLimit ?? Number.MAX_SAFE_INTEGER;
    if (!campaignDailyCap) {
      return base;
    }

    return Math.min(base, campaignDailyCap);
  }

  private resolveSenderHourlyLimit(
    sender: { email?: { hourlyLimit: number } | null },
    campaignDailyCap: number | null,
  ): number {
    const base = sender.email?.hourlyLimit ?? Number.MAX_SAFE_INTEGER;
    if (!campaignDailyCap) {
      return base;
    }

    return Math.min(base, campaignDailyCap);
  }

  private toResponse(campaign: CampaignDocument): CampaignResponse {
    return {
      id: campaign.id,
      workspaceId: campaign.workspaceId.toString(),
      name: campaign.name,
      channel: campaign.channel,
      senderAccountIds: campaign.senderAccountIds.map((id) => id.toString()),
      segmentId: campaign.segmentId ? campaign.segmentId.toString() : null,
      contactIds: campaign.contactIds.map((id) => id.toString()),
      templateId: campaign.templateId.toString(),
      status: campaign.status,
      timezone: campaign.timezone,
      startAt: campaign.startAt,
      sendingWindowStart: campaign.sendingWindowStart,
      sendingWindowEnd: campaign.sendingWindowEnd,
      dailyCap: campaign.dailyCap,
      trackOpens: campaign.trackOpens,
      trackClicks: campaign.trackClicks,
      randomDelayMinSeconds: campaign.randomDelayMinSeconds,
      randomDelayMaxSeconds: campaign.randomDelayMaxSeconds,
      settings: {
        distributionStrategy:
          campaign.settings?.distributionStrategy ?? CampaignDistributionStrategy.ROUND_ROBIN,
      },
      stats: {
        totalRecipients: campaign.stats?.totalRecipients ?? 0,
        queuedRecipients: campaign.stats?.queuedRecipients ?? 0,
        skippedRecipients: campaign.stats?.skippedRecipients ?? 0,
        sentRecipients: campaign.stats?.sentRecipients ?? 0,
        failedRecipients: campaign.stats?.failedRecipients ?? 0,
        openCount: campaign.stats?.openCount ?? 0,
        uniqueOpenCount: campaign.stats?.uniqueOpenCount ?? 0,
        clickCount: campaign.stats?.clickCount ?? 0,
        uniqueClickCount: campaign.stats?.uniqueClickCount ?? 0,
        whatsappSentCount: campaign.stats?.whatsappSentCount ?? 0,
        whatsappDeliveredCount: campaign.stats?.whatsappDeliveredCount ?? 0,
        whatsappReadCount: campaign.stats?.whatsappReadCount ?? 0,
        whatsappFailedCount: campaign.stats?.whatsappFailedCount ?? 0,
        lastStartedAt: campaign.stats?.lastStartedAt ?? null,
        lastOpenedAt: campaign.stats?.lastOpenedAt ?? null,
        lastClickedAt: campaign.stats?.lastClickedAt ?? null,
        lastWhatsappStatusAt: campaign.stats?.lastWhatsappStatusAt ?? null,
      },
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private toContactResponse(contact: ContactDocument): ContactResponse {
    return {
      id: contact.id,
      workspaceId: contact.workspaceId.toString(),
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      tags: [...contact.tags],
      customFields: { ...(contact.customFields ?? {}) },
      emailStatus: contact.emailStatus,
      whatsappStatus: contact.whatsappStatus,
      subscriptionStatus: contact.subscriptionStatus,
      source: contact.source,
      notes: contact.notes,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  private assertDelayRange(minDelaySeconds?: number, maxDelaySeconds?: number): void {
    if (
      minDelaySeconds !== undefined &&
      maxDelaySeconds !== undefined &&
      maxDelaySeconds < minDelaySeconds
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_DELAY_RANGE',
        'randomDelayMaxSeconds must be greater than or equal to randomDelayMinSeconds',
      );
    }
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

  private uniqueObjectIds(ids: string[]): Types.ObjectId[] {
    return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).map((id) =>
      this.toObjectId(id, 'INVALID_ID'),
    );
  }

  private toObjectId(id: string, code: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppException(HttpStatus.BAD_REQUEST, code, 'Invalid ObjectId');
    }

    return new Types.ObjectId(id);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
}
