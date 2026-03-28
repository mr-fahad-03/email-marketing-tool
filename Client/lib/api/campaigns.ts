import { apiRequest } from '@/lib/api/fetcher';
import type {
  Campaign,
  CampaignBuilderValues,
  CampaignsListResult,
  CampaignsPagination,
} from '@/lib/types/campaign';

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

function cleanObject<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      continue;
    }

    output[key] = value;
  }

  return output as T;
}

function buildPayload(values: CampaignBuilderValues): Record<string, unknown> {
  return cleanObject({
    name: values.name.trim(),
    channel: values.channel,
    senderAccountIds: values.senderAccountIds,
    segmentId: values.targetMode === 'segment' ? values.segmentId : undefined,
    contactIds: values.targetMode === 'contacts' ? values.contactIds : undefined,
    templateId: values.templateId,
    timezone: values.timezone,
    startAt: values.scheduleMode === 'scheduled' ? values.startAt : undefined,
    sendingWindowStart: values.sendingWindowStart,
    sendingWindowEnd: values.sendingWindowEnd,
    dailyCap: values.dailyCap,
    status: values.scheduleMode === 'scheduled' ? 'scheduled' : 'draft',
  });
}

function normalizeCampaign(input: unknown): Campaign {
  const record = getRecord(input);
  if (!record) {
    throw new Error('Invalid campaign payload.');
  }

  const id = getString(record, ['id', '_id']);
  const name = getString(record, ['name']);
  if (!id || !name) {
    throw new Error('Campaign payload is missing required fields.');
  }

  const channelRaw = getString(record, ['channel']) ?? 'email';
  const channel = channelRaw === 'whatsapp' ? 'whatsapp' : 'email';
  const statsRecord = getRecord(record.stats) ?? {};

  return {
    id,
    workspaceId: getString(record, ['workspaceId']),
    name,
    channel,
    senderAccountIds: Array.isArray(record.senderAccountIds)
      ? record.senderAccountIds.filter((value): value is string => typeof value === 'string')
      : [],
    segmentId: getString(record, ['segmentId']) ?? null,
    contactIds: Array.isArray(record.contactIds)
      ? record.contactIds.filter((value): value is string => typeof value === 'string')
      : [],
    templateId: getString(record, ['templateId']),
    status: getString(record, ['status']),
    timezone: getString(record, ['timezone']),
    startAt: getString(record, ['startAt']) ?? null,
    sendingWindowStart: getString(record, ['sendingWindowStart']) ?? null,
    sendingWindowEnd: getString(record, ['sendingWindowEnd']) ?? null,
    dailyCap: getNumber(record, ['dailyCap']) ?? null,
    createdAt: getString(record, ['createdAt']),
    updatedAt: getString(record, ['updatedAt']),
    stats: {
      totalRecipients: getNumber(statsRecord, ['totalRecipients']),
      queuedRecipients: getNumber(statsRecord, ['queuedRecipients']),
      skippedRecipients: getNumber(statsRecord, ['skippedRecipients']),
      sentRecipients: getNumber(statsRecord, ['sentRecipients']),
      failedRecipients: getNumber(statsRecord, ['failedRecipients']),
      openCount: getNumber(statsRecord, ['openCount']),
      clickCount: getNumber(statsRecord, ['clickCount']),
      whatsappSentCount: getNumber(statsRecord, ['whatsappSentCount']),
      whatsappDeliveredCount: getNumber(statsRecord, ['whatsappDeliveredCount']),
      whatsappReadCount: getNumber(statsRecord, ['whatsappReadCount']),
      whatsappFailedCount: getNumber(statsRecord, ['whatsappFailedCount']),
    },
  };
}

function parsePagination(
  record: Record<string, unknown>,
  fallbackLimit: number,
): CampaignsPagination {
  const paginationRecord = getRecord(record.pagination) ?? {};
  const page = getNumber(paginationRecord, ['page']) ?? 1;
  const limit = getNumber(paginationRecord, ['limit']) ?? fallbackLimit;
  const total = getNumber(paginationRecord, ['total']) ?? 0;
  const totalPages = Math.max(1, getNumber(paginationRecord, ['totalPages']) ?? 1);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: Boolean(paginationRecord.hasNext ?? page < totalPages),
    hasPrevious: Boolean(paginationRecord.hasPrevious ?? page > 1),
  };
}

export async function createCampaign(values: CampaignBuilderValues): Promise<Campaign> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'POST',
    url: '/campaigns',
    data: buildPayload(values),
  });

  return normalizeCampaign(payload);
}

export async function startCampaign(campaignId: string): Promise<void> {
  await apiRequest<unknown>({
    method: 'POST',
    url: `/campaigns/${campaignId}/start`,
  });
}

export async function getCampaigns(params: {
  page?: number;
  limit?: number;
  channel?: 'email' | 'whatsapp';
  status?: string;
  search?: string;
} = {}): Promise<CampaignsListResult> {
  const limit = params.limit ?? 10;
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/campaigns',
    params: {
      page: params.page ?? 1,
      limit,
      channel: params.channel,
      status: params.status,
      search: params.search,
    },
  });

  if (Array.isArray(payload)) {
    return {
      items: payload.map(normalizeCampaign),
      pagination: {
        page: params.page ?? 1,
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
        page: params.page ?? 1,
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
    items: itemsRaw.map(normalizeCampaign),
    pagination: parsePagination(record, limit),
  };
}

export async function getCampaignContacts(
  campaignId: string,
  params: { page?: number; limit?: number } = {},
): Promise<import('@/lib/types/contact').ContactsListResult> {
  const limit = params.limit ?? 25;
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: `/campaigns/${campaignId}/contacts`,
    params: {
      page: params.page ?? 1,
      limit,
    },
  });

  if (Array.isArray(payload)) {
    const { normalizeContact } = await import('@/lib/api/contacts-internal');
    return {
      items: payload.map(normalizeContact),
      pagination: {
        page: params.page ?? 1,
        limit,
        total: payload.length,
        totalPages: 1,
      },
    };
  }

  const record = getRecord(payload);
  if (!record) {
    return {
      items: [],
      pagination: {
        page: params.page ?? 1,
        limit,
        total: 0,
        totalPages: 1,
      },
    };
  }

  const itemsRaw =
    (Array.isArray(record.items) && record.items) ||
    (Array.isArray(record.results) && record.results) ||
    (Array.isArray(record.data) && record.data) ||
    [];

  const { normalizeContact } = await import('@/lib/api/contacts-internal');

  return {
    items: itemsRaw.map(normalizeContact),
    pagination: {
      page: getNumber(getRecord(record.pagination) ?? {}, ['page']) ?? (params.page ?? 1),
      limit: getNumber(getRecord(record.pagination) ?? {}, ['limit']) ?? limit,
      total: getNumber(getRecord(record.pagination) ?? {}, ['total']) ?? itemsRaw.length,
      totalPages: getNumber(getRecord(record.pagination) ?? {}, ['totalPages']) ?? 1,
    },
  };
}
