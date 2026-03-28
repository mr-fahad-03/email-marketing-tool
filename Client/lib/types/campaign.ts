export type CampaignChannel = 'email' | 'whatsapp';
export type CampaignTargetMode = 'segment' | 'contacts';
export type CampaignScheduleMode = 'now' | 'scheduled';

export interface CampaignBuilderValues {
  name: string;
  description?: string;
  channel: CampaignChannel;
  targetMode: CampaignTargetMode;
  segmentId?: string;
  contactIds: string[];
  senderAccountIds: string[];
  templateId?: string;
  scheduleMode: CampaignScheduleMode;
  timezone: string;
  startAt?: string;
  sendingWindowStart?: string;
  sendingWindowEnd?: string;
  dailyCap?: number;
}

export interface Campaign {
  id: string;
  workspaceId?: string;
  name: string;
  channel: CampaignChannel;
  senderAccountIds: string[];
  segmentId?: string | null;
  contactIds: string[];
  templateId?: string;
  status?: string;
  timezone?: string;
  startAt?: string | null;
  sendingWindowStart?: string | null;
  sendingWindowEnd?: string | null;
  dailyCap?: number | null;
  createdAt?: string;
  updatedAt?: string;
  stats?: {
    totalRecipients?: number;
    queuedRecipients?: number;
    skippedRecipients?: number;
    sentRecipients?: number;
    failedRecipients?: number;
    openCount?: number;
    clickCount?: number;
    whatsappSentCount?: number;
    whatsappDeliveredCount?: number;
    whatsappReadCount?: number;
    whatsappFailedCount?: number;
  };
}

export interface CampaignsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CampaignsListResult {
  items: Campaign[];
  pagination: CampaignsPagination;
}
