import type { Contact } from '@/lib/types/contact';

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

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

export function normalizeContact(input: unknown): Contact {
  const record = getRecord(input);
  if (!record) {
    throw new Error('Invalid contact payload.');
  }

  const id = getString(record, ['id', '_id']);
  if (!id) {
    throw new Error('Contact payload is missing an ID.');
  }

  return {
    id,
    workspaceId: getString(record, ['workspaceId']),
    firstName: getString(record, ['firstName']),
    lastName: getString(record, ['lastName']),
    fullName: getString(record, ['fullName']),
    email: getString(record, ['email']),
    phone: getString(record, ['phone']),
    company: getString(record, ['company']),
    tags: getStringArray(record.tags),
    customFields:
      record.customFields !== null &&
      typeof record.customFields === 'object' &&
      !Array.isArray(record.customFields)
        ? (record.customFields as Record<string, unknown>)
        : undefined,
    emailStatus: getString(record, ['emailStatus']),
    whatsappStatus: getString(record, ['whatsappStatus']),
    subscriptionStatus: getString(record, ['subscriptionStatus']),
    source: getString(record, ['source']),
    notes: getString(record, ['notes']),
    createdAt: getString(record, ['createdAt']),
    updatedAt: getString(record, ['updatedAt']),
  };
}
