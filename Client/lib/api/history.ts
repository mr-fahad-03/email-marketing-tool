import { apiRequest } from '@/lib/api/fetcher';
import { clampPageLimit } from '@/lib/api/pagination';
import type {
  HistoryEvent,
  HistoryEventTypeFilter,
  HistoryFilters,
  HistoryListResult,
  HistoryPagination,
} from '@/lib/types/history';

const DEFAULT_LIMIT = 20;

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

function getBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }

      if (normalized === 'false') {
        return false;
      }
    }
  }

  return undefined;
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date(0).toISOString();
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  const record = getRecord(value);
  return record ?? {};
}

function normalizeHistoryEvent(input: unknown): HistoryEvent {
  const record = getRecord(input);
  if (!record) {
    throw new Error('Invalid history event payload.');
  }

  const id = getString(record, ['id', '_id']);
  if (!id) {
    throw new Error('History event payload is missing an ID.');
  }

  const channelValue = getString(record, ['channel']);
  const channel = channelValue === 'whatsapp' ? 'whatsapp' : channelValue === 'email' ? 'email' : null;

  return {
    id,
    source: getString(record, ['source']) ?? 'send_event',
    timestamp: normalizeDate(record.timestamp ?? record.createdAt),
    campaignId: getString(record, ['campaignId']) ?? null,
    campaignRecipientId: getString(record, ['campaignRecipientId']) ?? null,
    contactId: getString(record, ['contactId']) ?? null,
    senderAccountId: getString(record, ['senderAccountId']) ?? null,
    channel,
    eventType: getString(record, ['eventType']) ?? 'unknown',
    address: getString(record, ['address']) ?? null,
    providerMessageId: getString(record, ['providerMessageId']) ?? null,
    failureCode: getString(record, ['failureCode']) ?? null,
    failureMessage: getString(record, ['failureMessage']) ?? null,
    metadata: normalizeMetadata(record.metadata),
  };
}

function parsePagination(record: Record<string, unknown>, fallbackLimit: number): HistoryPagination {
  const paginationRecord = getRecord(record.pagination) ?? {};

  const page = getNumber(paginationRecord, ['page']) ?? 1;
  const limit = getNumber(paginationRecord, ['limit']) ?? fallbackLimit;
  const total = getNumber(paginationRecord, ['total']) ?? 0;
  const fallbackPages = Math.ceil(total / limit) || 1;
  const totalPages = Math.max(1, getNumber(paginationRecord, ['totalPages']) ?? fallbackPages);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: getBoolean(paginationRecord, ['hasNext']) ?? page < totalPages,
    hasPrevious: getBoolean(paginationRecord, ['hasPrevious']) ?? page > 1,
  };
}

function toEventTypeQueryValue(filter: HistoryEventTypeFilter): string | undefined {
  switch (filter) {
    case 'sent':
      return 'sent';
    case 'opened':
      return 'opened,open';
    case 'clicked':
      return 'clicked,click';
    case 'failed':
      return 'failed,bounce,bounced,hard_bounce,permanent_failure';
    case 'all':
    default:
      return undefined;
  }
}

export async function getHistory(filters: HistoryFilters = {}): Promise<HistoryListResult> {
  const limit = clampPageLimit(filters.limit, DEFAULT_LIMIT);
  const eventTypeFilter = filters.eventType ?? 'all';
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/history',
    params: {
      page: filters.page ?? 1,
      limit,
      campaignId: filters.campaignId?.trim() || undefined,
      contactId: filters.contactId?.trim() || undefined,
      eventType: toEventTypeQueryValue(eventTypeFilter),
    },
  });

  if (Array.isArray(payload)) {
    return {
      items: payload.map(normalizeHistoryEvent),
      pagination: {
        page: filters.page ?? 1,
        limit,
        total: payload.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    };
  }

  const record = getRecord(payload);
  if (!record) {
    return {
      items: [],
      pagination: {
        page: filters.page ?? 1,
        limit,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    };
  }

  const itemsRaw =
    (Array.isArray(record.items) && record.items) ||
    (Array.isArray(record.results) && record.results) ||
    (Array.isArray(record.data) && record.data) ||
    [];

  return {
    items: itemsRaw.map(normalizeHistoryEvent),
    pagination: parsePagination(record, limit),
  };
}
