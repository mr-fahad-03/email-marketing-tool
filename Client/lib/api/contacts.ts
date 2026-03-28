import { apiRequest } from '@/lib/api/fetcher';
import { normalizeContact } from '@/lib/api/contacts-internal';
import type {
  Contact,
  ContactFilters,
  ContactsImportResult,
  ContactsListResult,
  ContactsPagination,
} from '@/lib/types/contact';
import type { ContactFormValues } from '@/lib/validators/contact';

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

function parsePagination(record: Record<string, unknown>, fallbackLimit: number): ContactsPagination {
  const paginationRecord = getRecord(record.pagination);

  return {
    page: getNumber(paginationRecord ?? {}, ['page']) ?? 1,
    limit: getNumber(paginationRecord ?? {}, ['limit']) ?? fallbackLimit,
    total: getNumber(paginationRecord ?? {}, ['total']) ?? 0,
    totalPages: getNumber(paginationRecord ?? {}, ['totalPages']) ?? 1,
  };
}

function cleanPayload(values: ContactFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    firstName: values.firstName?.trim() || undefined,
    lastName: values.lastName?.trim() || undefined,
    fullName: values.fullName?.trim() || undefined,
    email: values.email?.trim() || undefined,
    phone: values.phone?.trim() || undefined,
    company: values.company?.trim() || undefined,
    tags: values.tags ?? [],
    source: values.source?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
    subscriptionStatus: values.subscriptionStatus || undefined,
  };

  return payload;
}

export async function getContacts(filters: ContactFilters = {}): Promise<ContactsListResult> {
  const limit = filters.limit ?? 10;
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/contacts',
    params: {
      page: filters.page ?? 1,
      limit,
      search: filters.search || undefined,
      tags: filters.tags?.length ? filters.tags.join(',') : undefined,
      subscriptionStatus: filters.status || undefined,
    },
  });

  if (Array.isArray(payload)) {
    return {
      items: payload.map(normalizeContact),
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
    items: itemsRaw.map(normalizeContact),
    pagination: parsePagination(record, limit),
  };
}

export async function createContact(values: ContactFormValues): Promise<Contact> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'POST',
    url: '/contacts',
    data: cleanPayload(values),
  });

  return normalizeContact(payload);
}

export async function updateContact(id: string, values: ContactFormValues): Promise<Contact> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'PATCH',
    url: `/contacts/${id}`,
    data: cleanPayload(values),
  });

  return normalizeContact(payload);
}

export async function deleteContact(id: string): Promise<void> {
  await apiRequest<unknown>({
    method: 'DELETE',
    url: `/contacts/${id}`,
  });
}

export async function importContacts(file: File): Promise<ContactsImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const payload = await apiRequest<unknown, FormData>({
    method: 'POST',
    url: '/contacts/import',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const record = getRecord(payload);
  if (!record) {
    return {
      created: 0,
      skipped: 0,
      invalid: 0,
      message: 'Import completed.',
    };
  }

  return {
    created: getNumber(record, ['created']) ?? 0,
    skipped: getNumber(record, ['skipped']) ?? 0,
    invalid: getNumber(record, ['invalid']) ?? 0,
    message: getString(record, ['message']) ?? 'Import completed.',
  };
}

export async function bulkDeleteContacts(ids: string[]): Promise<{ requested: number; deleted: number }> {
  const payload = await apiRequest<unknown, { ids: string[] }>({
    method: 'POST',
    url: '/contacts/bulk-delete',
    data: { ids },
  });

  const record = getRecord(payload);
  if (!record) {
    return {
      requested: ids.length,
      deleted: ids.length,
    };
  }

  return {
    requested: getNumber(record, ['requested']) ?? ids.length,
    deleted: getNumber(record, ['deleted']) ?? 0,
  };
}

export async function bulkAddTagToContacts(
  ids: string[],
  tag: string,
): Promise<{ requested: number; modified: number }> {
  const payload = await apiRequest<unknown, { ids: string[]; addTags: string[] }>({
    method: 'POST',
    url: '/contacts/bulk-tags',
    data: {
      ids,
      addTags: [tag],
    },
  });

  const record = getRecord(payload);
  if (!record) {
    return {
      requested: ids.length,
      modified: ids.length,
    };
  }

  return {
    requested: getNumber(record, ['requested']) ?? ids.length,
    modified: getNumber(record, ['modified']) ?? 0,
  };
}
