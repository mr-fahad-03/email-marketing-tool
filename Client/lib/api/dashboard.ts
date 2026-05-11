import { apiRequest } from '@/lib/api/fetcher';
import { fetchAllPages } from '@/lib/api/pagination';
import { getCampaigns } from '@/lib/api/campaigns';
import { getContacts } from '@/lib/api/contacts';
import type { Campaign } from '@/lib/types/campaign';
import type {
  DashboardActivityItem,
  DashboardOverview,
  DashboardQuickStat,
  DashboardTotals,
} from '@/lib/types/dashboard';

function getRecord(input: unknown): Record<string, unknown> | null {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return null;
}

function getString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function getNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function getHistoryItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item),
    );
  }

  const record = getRecord(payload);
  if (!record) {
    return [];
  }

  const candidate =
    (Array.isArray(record.items) && record.items) ||
    (Array.isArray(record.results) && record.results) ||
    (Array.isArray(record.data) && record.data) ||
    [];

  return candidate.filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  );
}

function getHistoryTotal(payload: unknown): number {
  const record = getRecord(payload);
  const pagination = getRecord(record?.pagination);

  if (pagination) {
    return getNumber(pagination, ['total']) ?? 0;
  }

  if (Array.isArray(payload)) {
    return payload.length;
  }

  return 0;
}

function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1)}%`;
}

function computeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function toRelativeTime(isoTimestamp: string): string {
  const timestamp = new Date(isoTimestamp).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Unknown time';
  }

  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function toActivityChannel(value: string | undefined): DashboardActivityItem['channel'] {
  if (value === 'email' || value === 'whatsapp') {
    return value;
  }

  return 'system';
}

function normalizeEventLabel(eventType: string): string {
  const normalized = eventType.trim().toLowerCase();
  if (normalized === 'open') {
    return 'opened';
  }

  if (normalized === 'click') {
    return 'clicked';
  }

  return normalized.replace(/_/g, ' ');
}

function formatEventTitle(eventType: string, channel: DashboardActivityItem['channel']): string {
  const eventLabel = normalizeEventLabel(eventType);

  if (eventLabel === 'sent') {
    return `Message sent (${channel})`;
  }

  if (eventLabel === 'opened') {
    return 'Email opened';
  }

  if (eventLabel === 'clicked') {
    return 'Email clicked';
  }

  if (eventLabel === 'failed') {
    return `Delivery failed (${channel})`;
  }

  return `${eventLabel[0]?.toUpperCase() ?? ''}${eventLabel.slice(1)} (${channel})`;
}

function shortenId(value: string | undefined): string {
  if (!value) {
    return 'N/A';
  }

  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function getHistoryCount(params: {
  eventType?: string;
  channel?: 'email' | 'whatsapp';
}): Promise<number> {
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/history',
    params: {
      page: 1,
      limit: 1,
      eventType: params.eventType,
      channel: params.channel,
    },
  });

  return getHistoryTotal(payload);
}

async function getRecentHistory(limit = 5): Promise<Record<string, unknown>[]> {
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/history',
    params: {
      page: 1,
      limit,
    },
  });

  return getHistoryItems(payload);
}

type CampaignStatsSnapshot = {
  totalCampaigns: number;
  emailSent: number;
  emailOpened: number;
  emailClicked: number;
  emailFailed: number;
  whatsappSent: number;
  whatsappDeliveredOrRead: number;
};

function toSafeNumber(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value as number;
}

async function getCampaignStatsSnapshot(): Promise<CampaignStatsSnapshot> {
  const campaigns = await fetchAllPages<Campaign>(
    async (page, limit) => getCampaigns({ page, limit }),
    { pageLimit: 100, maxPages: 1000 },
  );

  return campaigns.reduce<CampaignStatsSnapshot>(
    (acc, campaign) => {
      acc.totalCampaigns += 1;

      const stats = campaign.stats;
      if (!stats) {
        return acc;
      }

      if (campaign.channel === 'email') {
        acc.emailSent += toSafeNumber(stats.sentRecipients);
        acc.emailOpened += toSafeNumber(stats.openCount);
        acc.emailClicked += toSafeNumber(stats.clickCount);
        acc.emailFailed += toSafeNumber(stats.failedRecipients);
      } else {
        acc.whatsappSent +=
          toSafeNumber(stats.whatsappSentCount) || toSafeNumber(stats.sentRecipients);
        acc.whatsappDeliveredOrRead += Math.max(
          toSafeNumber(stats.whatsappDeliveredCount),
          toSafeNumber(stats.whatsappReadCount),
        );
      }

      return acc;
    },
    {
      totalCampaigns: 0,
      emailSent: 0,
      emailOpened: 0,
      emailClicked: 0,
      emailFailed: 0,
      whatsappSent: 0,
      whatsappDeliveredOrRead: 0,
    },
  );
}

function toDashboardQuickStats(snapshot: CampaignStatsSnapshot): DashboardQuickStat[] {
  const emailSent = snapshot.emailSent;
  const emailOpened = snapshot.emailOpened;
  const emailClicked = snapshot.emailClicked;
  const emailFailed = snapshot.emailFailed;
  const whatsappSent = snapshot.whatsappSent;
  const whatsappDelivered = snapshot.whatsappDeliveredOrRead;

  return [
    {
      id: 'email-open-rate',
      label: 'Email Open Rate',
      value: formatPercent(computeRate(emailOpened, emailSent)),
      helper: `${emailOpened} opens from ${emailSent} sent`,
    },
    {
      id: 'email-click-rate',
      label: 'Email Click Rate',
      value: formatPercent(computeRate(emailClicked, emailSent)),
      helper: `${emailClicked} clicks from ${emailSent} sent`,
    },
    {
      id: 'delivery-health',
      label: 'Email Failure Rate',
      value: formatPercent(computeRate(emailFailed, emailSent)),
      helper: `${emailFailed} failed sends`,
    },
    {
      id: 'whatsapp-delivery-rate',
      label: 'WhatsApp Delivery',
      value: formatPercent(computeRate(whatsappDelivered, whatsappSent)),
      helper: `${whatsappDelivered} delivered/read of ${whatsappSent} sent`,
    },
  ];
}

export async function getDashboardTotals(): Promise<DashboardTotals> {
  const [contacts, snapshot] = await Promise.all([
    getContacts({ page: 1, limit: 1 }),
    getCampaignStatsSnapshot(),
  ]);

  return {
    totalContacts: contacts.pagination.total,
    totalCampaigns: snapshot.totalCampaigns,
    totalEmailsSent: snapshot.emailSent,
    totalWhatsAppMessages: snapshot.whatsappSent,
  };
}

export async function getDashboardQuickStats(): Promise<DashboardQuickStat[]> {
  const snapshot = await getCampaignStatsSnapshot();
  return toDashboardQuickStats(snapshot);
}

export async function getDashboardRecentActivity(): Promise<DashboardActivityItem[]> {
  const events = await getRecentHistory(5);

  return events.map((item, index) => {
    const channel = toActivityChannel(getString(item, ['channel']));
    const eventType = getString(item, ['eventType']) ?? 'event';
    const campaignId = getString(item, ['campaignId']);
    const contactId = getString(item, ['contactId']);
    const timestamp = getString(item, ['timestamp']) ?? '';

    return {
      id: getString(item, ['id', '_id']) ?? `history-${index}`,
      title: formatEventTitle(eventType, channel),
      description: `Campaign ${shortenId(campaignId)} | Contact ${shortenId(contactId)}`,
      timestamp: toRelativeTime(timestamp),
      channel,
    };
  });
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [contacts, snapshot, recentActivity] = await Promise.all([
    getContacts({ page: 1, limit: 1 }),
    getCampaignStatsSnapshot(),
    getDashboardRecentActivity(),
  ]);

  const totals: DashboardTotals = {
    totalContacts: contacts.pagination.total,
    totalCampaigns: snapshot.totalCampaigns,
    totalEmailsSent: snapshot.emailSent,
    totalWhatsAppMessages: snapshot.whatsappSent,
  };

  const quickStats = toDashboardQuickStats(snapshot);

  return {
    totals,
    quickStats,
    recentActivity,
  };
}
