import { apiRequest } from '@/lib/api/fetcher';
import type {
  AnalyticsTimelinePoint,
  CampaignAnalytics,
  CampaignStatMetrics,
  DeliveryBreakdown,
  SenderPerformanceMetric,
} from '@/lib/types/analytics';

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

function normalizeRate(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(2));
}

function normalizeRatePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value <= 1 ? value * 100 : value;
  return Number(normalized.toFixed(2));
}

function computeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return normalizeRate((numerator / denominator) * 100);
}

function parseStats(record: Record<string, unknown>): CampaignStatMetrics {
  const summaryRecord = getRecord(record.summary);
  const recipientsRecord = getRecord(summaryRecord?.recipients);
  const engagementRecord = getRecord(summaryRecord?.engagement);
  const ratesRecord = getRecord(summaryRecord?.rates);
  const deliveryRecord = getRecord(record.delivery);

  const sent =
    getNumber(record, ['sent', 'totalSent']) ??
    getNumber(recipientsRecord ?? {}, ['sent']) ??
    0;
  const delivered =
    getNumber(record, ['delivered', 'totalDelivered']) ??
    getNumber(deliveryRecord ?? {}, ['delivered']) ??
    0;
  const opens =
    getNumber(record, ['opens', 'totalOpens']) ??
    getNumber(engagementRecord ?? {}, ['opens']) ??
    0;
  const clicks =
    getNumber(record, ['clicks', 'totalClicks']) ??
    getNumber(engagementRecord ?? {}, ['clicks']) ??
    0;
  const bounced =
    getNumber(record, ['bounced', 'totalBounced']) ??
    getNumber(deliveryRecord ?? {}, ['bounced']) ??
    0;
  const failed =
    getNumber(record, ['failed', 'totalFailed']) ??
    getNumber(recipientsRecord ?? {}, ['failed']) ??
    0;

  const rawOpenRate =
    getNumber(record, ['openRate']) ?? getNumber(ratesRecord ?? {}, ['openRate']);
  const rawClickRate =
    getNumber(record, ['clickRate']) ?? getNumber(ratesRecord ?? {}, ['clickRate']);
  const rawDeliveryRate =
    getNumber(record, ['deliveryRate']) ?? getNumber(ratesRecord ?? {}, ['deliveryRate']);

  return {
    sent,
    delivered,
    opens,
    clicks,
    bounced,
    failed,
    openRate:
      rawOpenRate === undefined
        ? computeRate(opens, delivered || sent)
        : normalizeRatePercent(rawOpenRate),
    clickRate:
      rawClickRate === undefined
        ? computeRate(clicks, delivered || sent)
        : normalizeRatePercent(rawClickRate),
    deliveryRate:
      rawDeliveryRate === undefined
        ? computeRate(delivered, sent)
        : normalizeRatePercent(rawDeliveryRate),
  };
}

function parseTimeline(payload: unknown): AnalyticsTimelinePoint[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      const record = getRecord(item);
      if (!record) {
        return null;
      }

      return {
        label: getString(record, ['label', 'date', 'timestamp']) ?? 'Point',
        sent: getNumber(record, ['sent']) ?? 0,
        delivered: getNumber(record, ['delivered']) ?? 0,
        opens: getNumber(record, ['opens']) ?? 0,
        clicks: getNumber(record, ['clicks']) ?? 0,
      };
    })
    .filter((item): item is AnalyticsTimelinePoint => item !== null);
}

function parseSenderPerformance(payload: unknown): SenderPerformanceMetric[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      const record = getRecord(item);
      if (!record) {
        return null;
      }

      const sent = getNumber(record, ['sent']) ?? 0;
      const delivered = getNumber(record, ['delivered']) ?? 0;
      const opens = getNumber(record, ['opens']) ?? 0;
      const clicks = getNumber(record, ['clicks']) ?? 0;

      return {
        senderAccountId: getString(record, ['senderAccountId', 'id', '_id']) ?? 'unknown',
        senderName: getString(record, ['senderName', 'name']) ?? 'Sender',
        sent,
        delivered,
        opens,
        clicks,
        deliveryRate: getNumber(record, ['deliveryRate']) ?? computeRate(delivered, sent),
        openRate: getNumber(record, ['openRate']) ?? computeRate(opens, delivered || sent),
        clickRate: getNumber(record, ['clickRate']) ?? computeRate(clicks, delivered || sent),
      };
    })
    .filter((item): item is SenderPerformanceMetric => item !== null);
}

function parseDelivery(record: Record<string, unknown>, stats: CampaignStatMetrics): DeliveryBreakdown {
  const deliveryRecord = getRecord(record.delivery) ?? record;
  const summaryRecord = getRecord(record.summary);
  const recipientsRecord = getRecord(summaryRecord?.recipients);

  return {
    delivered: getNumber(deliveryRecord, ['delivered']) ?? stats.delivered,
    bounced: getNumber(deliveryRecord, ['bounced']) ?? stats.bounced,
    failed: getNumber(deliveryRecord, ['failed']) ?? stats.failed,
    pending:
      getNumber(deliveryRecord, ['pending']) ??
      Math.max((getNumber(recipientsRecord ?? {}, ['queued']) ?? 0), 0),
  };
}

function normalizeCampaignAnalytics(payload: unknown, fallbackCampaignId: string): CampaignAnalytics {
  const record = getRecord(payload);
  if (!record) {
    throw new Error('Invalid analytics payload.');
  }

  const campaign = getRecord(record.campaign) ?? record;
  const statsRecord = getRecord(record.stats) ?? record;

  const stats = parseStats(statsRecord);
  const timeline = parseTimeline(record.timeline);
  const senderPerformance = parseSenderPerformance(record.senderPerformance);

  return {
    campaignId: getString(campaign, ['id', '_id', 'campaignId']) ?? fallbackCampaignId,
    campaignName: getString(campaign, ['name', 'campaignName']) ?? 'Campaign Analytics',
    channel: (getString(campaign, ['channel']) === 'whatsapp' ? 'whatsapp' : 'email'),
    stats,
    timeline,
    senderPerformance,
    delivery: parseDelivery(record, stats),
  };
}

export async function getCampaignAnalytics(campaignIdentifier: string): Promise<CampaignAnalytics> {
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: `/analytics/campaigns/${encodeURIComponent(campaignIdentifier)}`,
  });

  return normalizeCampaignAnalytics(payload, campaignIdentifier);
}

