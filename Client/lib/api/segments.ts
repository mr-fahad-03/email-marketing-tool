import { apiRequest } from '@/lib/api/fetcher';
import type {
  Segment,
  SegmentFilters,
  SegmentQueryFilters,
  SegmentsListResult,
  SegmentsPagination,
} from '@/lib/types/segment';
import type { SegmentFormValues } from '@/lib/validators/segment';

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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function normalizeFilters(input: unknown): SegmentFilters {
  const record = getRecord(input);
  if (!record) {
    return { tags: [], status: [] };
  }

  const tags = toStringArray(record.tags);
  const singleStatus = getString(record, ['subscriptionStatus', 'status']);
  const status = singleStatus ? [singleStatus] : toStringArray(record.status);

  return { tags, status };
}

function normalizeSegment(input: unknown): Segment {
  const record = getRecord(input);
  if (!record) {
    throw new Error('Invalid segment payload.');
  }

  const id = getString(record, ['id', '_id']);
  const name = getString(record, ['name']);
  if (!id || !name) {
    throw new Error('Segment payload is missing required fields.');
  }

  const typeRaw = getString(record, ['type']) ?? 'static';
  const type = typeRaw === 'dynamic' ? 'dynamic' : 'static';

  return {
    id,
    workspaceId: getString(record, ['workspaceId']),
    name,
    description: getString(record, ['description']),
    type,
    filters: normalizeFilters(record.filters),
    contactIds: toStringArray(record.contactIds),
    estimatedCount:
      getNumber(record, ['estimatedCount', 'contactCount', 'count']) ?? 0,
    createdAt: getString(record, ['createdAt']),
    updatedAt: getString(record, ['updatedAt']),
  };
}

function parsePagination(record: Record<string, unknown>, fallbackLimit: number): SegmentsPagination {
  const pagination = getRecord(record.pagination);

  return {
    page: getNumber(pagination ?? {}, ['page']) ?? 1,
    limit: getNumber(pagination ?? {}, ['limit']) ?? fallbackLimit,
    total: getNumber(pagination ?? {}, ['total']) ?? 0,
    totalPages: getNumber(pagination ?? {}, ['totalPages']) ?? 1,
  };
}

function buildPayload(values: SegmentFormValues): Record<string, unknown> {
  const [subscriptionStatus] = values.filterStatus;
  const isContactDrivenStatic = values.type === 'static' && values.audienceMode === 'contacts';

  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    type: values.type,
    filters: {
      tags: isContactDrivenStatic ? [] : values.filterTags,
      subscriptionStatus: isContactDrivenStatic ? undefined : subscriptionStatus,
    },
    contactIds: values.type === 'static' ? values.contactIds : undefined,
  };
}

export async function getSegments(filters: SegmentQueryFilters = {}): Promise<SegmentsListResult> {
  const limit = filters.limit ?? 10;

  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/segments',
    params: {
      page: filters.page ?? 1,
      limit,
      search: filters.search || undefined,
      tags: filters.tag || undefined,
      subscriptionStatus: filters.status || undefined,
    },
  });

  if (Array.isArray(payload)) {
    return {
      items: payload.map(normalizeSegment),
      pagination: {
        page: filters.page ?? 1,
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
        page: filters.page ?? 1,
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

  return {
    items: itemsRaw.map(normalizeSegment),
    pagination: parsePagination(record, limit),
  };
}

export async function createSegment(values: SegmentFormValues): Promise<Segment> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'POST',
    url: '/segments',
    data: buildPayload(values),
  });

  return normalizeSegment(payload);
}

export async function updateSegment(id: string, values: SegmentFormValues): Promise<Segment> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'PATCH',
    url: `/segments/${id}`,
    data: buildPayload(values),
  });

  return normalizeSegment(payload);
}

export async function deleteSegment(id: string): Promise<void> {
  await apiRequest<unknown>({
    method: 'DELETE',
    url: `/segments/${id}`,
  });
}
