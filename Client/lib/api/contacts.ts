import { apiRequest } from '@/lib/api/fetcher';
import { normalizeContact } from '@/lib/api/contacts-internal';
import { BACKEND_MAX_PAGE_LIMIT, clampPageLimit, fetchAllPages } from '@/lib/api/pagination';
import type {
  ContactCategorySummaryResult,
  Contact,
  ContactFilters,
  ContactsImportResult,
  ContactsListResult,
  ContactsPagination,
} from '@/lib/types/contact';
import type { ContactFormValues } from '@/lib/validators/contact';

const VALID_SUBSCRIPTION_STATUSES = new Set([
  'subscribed',
  'pending',
  'unsubscribed',
  'suppressed',
]);

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
  const normalizedSubscriptionStatus =
    values.subscriptionStatus && VALID_SUBSCRIPTION_STATUSES.has(values.subscriptionStatus)
      ? values.subscriptionStatus
      : 'subscribed';

  const normalizedCategory = values.category?.trim() || undefined;

  const normalizedLabels = Array.from(
    new Set(
      (values.labels ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

  const resolvePrimaryPhone = () => {
    const candidates = [values.mobile, values.telephone, values.additionalNumber, values.phone];
    for (const candidate of candidates) {
      const normalized = candidate?.trim();
      if (normalized) {
        return normalized;
      }
    }

    return undefined;
  };

  const mergedCustomFields: Record<string, unknown> = {
    ...(values.customFields ?? {}),
  };

  const csvCustomFieldMap: Array<[string, string | undefined]> = [
    ['country', values.country?.trim()],
    ['city', values.city?.trim()],
    ['telephone', values.telephone?.trim()],
    ['mobile', values.mobile?.trim()],
    ['additionalNumber', values.additionalNumber?.trim()],
    ['designation', values.designation?.trim()],
    ['department', values.department?.trim()],
    ['leadSource', values.leadSource?.trim()],
  ];

  for (const [key, fieldValue] of csvCustomFieldMap) {
    if (fieldValue) {
      mergedCustomFields[key] = fieldValue;
    } else if (key in mergedCustomFields) {
      delete mergedCustomFields[key];
    }
  }

  const payload: Record<string, unknown> = {
    fullName: values.fullName?.trim() || undefined,
    email: values.email?.trim() || undefined,
    phone: resolvePrimaryPhone(),
    company: values.company?.trim() || undefined,
    category: normalizedCategory,
    labels: normalizedLabels,
    customFields: Object.keys(mergedCustomFields).length ? mergedCustomFields : undefined,
    notes: values.notes?.trim() || undefined,
    subscriptionStatus: normalizedSubscriptionStatus,
  };

  return payload;
}

export async function getContacts(filters: ContactFilters = {}): Promise<ContactsListResult> {
  const limit = clampPageLimit(filters.limit, 10);
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/contacts',
    params: {
      page: filters.page ?? 1,
      limit,
      search: filters.search || undefined,
      contactName: filters.contactName || undefined,
      email: filters.email || undefined,
      company: filters.company || undefined,
      country: filters.country || undefined,
      city: filters.city || undefined,
      telephone: filters.telephone || undefined,
      mobile: filters.mobile || undefined,
      additionalNumber: filters.additionalNumber || undefined,
      designation: filters.designation || undefined,
      department: filters.department || undefined,
      leadSource: filters.leadSource || undefined,
      category: filters.category || undefined,
      labels: filters.labels?.length ? filters.labels.join(',') : undefined,
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

export async function getAllContacts(filters: ContactFilters = {}): Promise<Contact[]> {
  const merged = await fetchAllPages((page, limit) => getContacts({ ...filters, page, limit }), {
    maxPages: 1000,
    pageLimit: BACKEND_MAX_PAGE_LIMIT,
    startPage: 1,
  });

  const uniqueById = new Map<string, Contact>();
  for (const contact of merged) {
    uniqueById.set(contact.id, contact);
  }

  return Array.from(uniqueById.values());
}

export async function getContactCategorySummary(): Promise<ContactCategorySummaryResult> {
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/contacts/categories/summary',
  });

  const record = getRecord(payload);
  if (!record) {
    return {
      total: 0,
      categories: [],
    };
  }

  const categoriesRaw = Array.isArray(record.categories) ? record.categories : [];
  const categories = categoriesRaw
    .map((item) => {
      const entry = getRecord(item);
      if (!entry) {
        return null;
      }

      const category = getString(entry, ['category']);
      const count = getNumber(entry, ['count']) ?? 0;

      if (!category) {
        return null;
      }

      return {
        category,
        count,
      };
    })
    .filter((item): item is { category: string; count: number } => Boolean(item));

  return {
    total: getNumber(record, ['total']) ?? 0,
    categories,
  };
}

export async function createContactCategory(category: string): Promise<{ category: string }> {
  const payload = await apiRequest<unknown, { category: string }>({
    method: 'POST',
    url: '/contacts/categories',
    data: {
      category,
    },
  });

  const record = getRecord(payload);
  if (!record) {
    return { category };
  }

  return {
    category: getString(record, ['category']) ?? category,
  };
}

export async function deleteContactCategory(
  category: string,
): Promise<{ category: string; modified: number }> {
  const normalizedCategory = category.trim();

  const payload = await apiRequest<unknown>({
    method: 'DELETE',
    url: `/contacts/categories/${encodeURIComponent(normalizedCategory)}`,
  });

  const record = getRecord(payload);
  if (!record) {
    return {
      category: normalizedCategory,
      modified: 0,
    };
  }

  return {
    category: getString(record, ['category']) ?? normalizedCategory,
    modified: getNumber(record, ['modified']) ?? 0,
  };
}

export async function createContact(values: ContactFormValues): Promise<void> {
  await apiRequest<unknown, Record<string, unknown>>({
    method: 'POST',
    url: '/contacts',
    data: cleanPayload(values),
  });
}

export async function updateContact(id: string, values: ContactFormValues): Promise<void> {
  await apiRequest<unknown, Record<string, unknown>>({
    method: 'PATCH',
    url: `/contacts/${id}`,
    data: cleanPayload(values),
  });
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
      total: 0,
      message: 'Import completed.',
    };
  }

  const rawInvalidRows = Array.isArray(record.invalidRows) ? record.invalidRows : [];
  const invalidRows = rawInvalidRows
    .map((item: unknown) => {
      const entry = getRecord(item);
      if (!entry) return null;
      const row = getNumber(entry, ['row']);
      const reason = getString(entry, ['reason']);
      if (row === undefined) return null;
      return { row, reason: reason ?? 'Unknown error' };
    })
    .filter((item): item is { row: number; reason: string } => item !== null);

  const rawSkippedRows = Array.isArray(record.skippedRows) ? record.skippedRows : [];
  const skippedRows = rawSkippedRows
    .map((item: unknown) => {
      const entry = getRecord(item);
      if (!entry) return null;
      const row = getNumber(entry, ['row']);
      if (row === undefined) return null;
      return {
        row,
        name: getString(entry, ['name']) ?? '',
        email: getString(entry, ['email']) ?? '',
        phone: getString(entry, ['phone']) ?? '',
        company: getString(entry, ['company']) ?? '',
        reason: getString(entry, ['reason']) ?? 'Already exists in system (duplicate)',
      };
    })
    .filter(
      (item): item is { row: number; name: string; email: string; phone: string; company: string; reason: string } =>
        item !== null,
    );

  return {
    created: getNumber(record, ['created']) ?? 0,
    skipped: getNumber(record, ['skipped']) ?? 0,
    invalid: getNumber(record, ['invalid']) ?? 0,
    total: getNumber(record, ['total']) ?? 0,
    message: getString(record, ['message']) ?? 'Import completed.',
    invalidRows,
    skippedRows,
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

export async function bulkSetCategoryToContacts(
  ids: string[],
  category: string,
): Promise<{ requested: number; modified: number }> {
  const payload = await apiRequest<unknown, { ids: string[]; category: string }>({
    method: 'POST',
    url: '/contacts/bulk-category',
    data: {
      ids,
      category,
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

export async function bulkAddLabelToContacts(
  ids: string[],
  label: string,
): Promise<{ requested: number; modified: number }> {
  const payload = await apiRequest<unknown, { ids: string[]; addLabels: string[] }>({
    method: 'POST',
    url: '/contacts/bulk-labels',
    data: {
      ids,
      addLabels: [label],
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
