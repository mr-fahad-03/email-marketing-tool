import {
  CampaignChannel,
  CampaignDistributionStrategy,
  CampaignStatus,
} from '../constants/campaign.enums';

export interface CampaignResponse {
  id: string;
  workspaceId: string;
  name: string;
  channel: CampaignChannel;
  senderAccountIds: string[];
  segmentId: string | null;
  contactIds: string[];
  templateId: string;
  status: CampaignStatus;
  timezone: string;
  startAt: Date | null;
  sendingWindowStart: string | null;
  sendingWindowEnd: string | null;
  dailyCap: number | null;
  trackOpens: boolean;
  trackClicks: boolean;
  randomDelayMinSeconds: number;
  randomDelayMaxSeconds: number;
  settings: {
    distributionStrategy: CampaignDistributionStrategy;
  };
  trackingBaseUrl: string | null;
  stats: {
    totalRecipients: number;
    queuedRecipients: number;
    skippedRecipients: number;
    sentRecipients: number;
    failedRecipients: number;
    openCount: number;
    uniqueOpenCount: number;
    clickCount: number;
    uniqueClickCount: number;
    whatsappSentCount: number;
    whatsappDeliveredCount: number;
    whatsappReadCount: number;
    whatsappFailedCount: number;
    lastStartedAt: Date | null;
    lastOpenedAt: Date | null;
    lastClickedAt: Date | null;
    lastWhatsappStatusAt: Date | null;
  };
  editedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CampaignListResponse {
  items: CampaignResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
