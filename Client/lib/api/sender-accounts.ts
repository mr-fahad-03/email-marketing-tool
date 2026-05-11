import { apiRequest } from '@/lib/api/fetcher';
import type { SenderAccount, SenderAccountTestResult, SenderAccountType } from '@/lib/types/sender-account';
import { getAuthWorkspaceId } from '@/lib/stores/auth-store';
import type { SenderAccountFormValues } from '@/lib/validators/sender-account';

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
  }

  return undefined;
}

function normalizeSenderAccount(input: unknown): SenderAccount {
  const record = getRecord(input);
  if (!record) {
    throw new Error('Invalid sender account payload.');
  }

  const id = getString(record, ['id', '_id']);
  const typeRaw = getString(record, ['channelType', 'type', 'channel']);
  const name = getString(record, ['name']);

  if (!id || !typeRaw || !name) {
    throw new Error('Sender account payload is missing required fields.');
  }

  const type = typeRaw === 'whatsapp' ? 'whatsapp' : 'email';
  const base = {
    id,
    type,
    name,
    workspaceId: getString(record, ['workspaceId']),
    status: getString(record, ['status']),
    healthStatus: getString(record, ['healthStatus']),
    lastTestedAt: getString(record, ['lastTestedAt']) ?? null,
  };

  if (type === 'email') {
    return {
      ...base,
      type: 'email',
      email: getString(record, ['email']) ?? '',
      providerType: getString(record, ['providerType']),
      smtpHost: getString(record, ['smtpHost']) ?? '',
      smtpPort: getNumber(record, ['smtpPort']) ?? 587,
      smtpUser: getString(record, ['smtpUser']) ?? '',
      smtpPass: getString(record, ['smtpPass']),
      secure: getBoolean(record, ['secure']) ?? false,
      dailyLimit: getNumber(record, ['dailyLimit']),
      hourlyLimit: getNumber(record, ['hourlyLimit']),
      minDelaySeconds: getNumber(record, ['minDelaySeconds']),
      maxDelaySeconds: getNumber(record, ['maxDelaySeconds']),
    };
  }

  return {
    ...base,
    type: 'whatsapp',
    phoneNumber: getString(record, ['phoneNumber']) ?? '',
    businessAccountId: getString(record, ['businessAccountId']),
    phoneNumberId: getString(record, ['phoneNumberId']) ?? '',
    accessToken: getString(record, ['accessToken']),
    webhookVerifyToken: getString(record, ['webhookVerifyToken']),
    qualityStatus: getString(record, ['qualityStatus']),
  };
}

function mapListPayload(payload: unknown): SenderAccount[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeSenderAccount);
  }

  const record = getRecord(payload);
  if (!record) {
    return [];
  }

  const listCandidates = [record.items, record.results, record.data];
  for (const candidate of listCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(normalizeSenderAccount);
    }
  }

  return [];
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

function buildPayload(values: SenderAccountFormValues): Record<string, unknown> {
  if (values.type === 'email') {
    return cleanObject({
      workspaceId: getAuthWorkspaceId(),
      channelType: values.type,
      name: values.name,
      status: values.status ?? 'active',
      email: values.email,
      providerType: values.providerType?.trim() || 'smtp',
      smtpHost: values.smtpHost,
      smtpPort: values.smtpPort,
      smtpUser: values.smtpUser,
      smtpPass: values.smtpPass,
      secure: values.secure ?? false,
      dailyLimit: values.dailyLimit,
      hourlyLimit: values.hourlyLimit,
      minDelaySeconds: values.minDelaySeconds,
      maxDelaySeconds: values.maxDelaySeconds,
    });
  }

  return cleanObject({
    workspaceId: getAuthWorkspaceId(),
    channelType: values.type,
    name: values.name,
    status: values.status ?? 'active',
    phoneNumber: values.phoneNumber,
    businessAccountId: values.businessAccountId,
    phoneNumberId: values.phoneNumberId,
    accessToken: values.accessToken,
    webhookVerifyToken: values.webhookVerifyToken,
  });
}

export async function getSenderAccounts(type?: SenderAccountType): Promise<SenderAccount[]> {
  const workspaceId = getAuthWorkspaceId();
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/sender-accounts',
    params: {
      workspaceId: workspaceId || undefined,
      channelType: type || undefined,
    },
  });

  return mapListPayload(payload);
}

export async function createSenderAccount(values: SenderAccountFormValues): Promise<SenderAccount> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'POST',
    url: '/sender-accounts',
    data: buildPayload(values),
  });

  return normalizeSenderAccount(payload);
}

export async function updateSenderAccount(
  id: string,
  values: SenderAccountFormValues,
): Promise<SenderAccount> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'PATCH',
    url: `/sender-accounts/${id}`,
    data: buildPayload(values),
  });

  return normalizeSenderAccount(payload);
}

export async function deleteSenderAccount(id: string): Promise<void> {
  await apiRequest<unknown>({
    method: 'DELETE',
    url: `/sender-accounts/${id}`,
  });
}

export async function testSenderAccount(id: string): Promise<SenderAccountTestResult> {
  const payload = await apiRequest<unknown>({
    method: 'POST',
    url: `/sender-accounts/${id}/test`,
  });

  const record = getRecord(payload);
  if (!record) {
    return {
      success: true,
      message: 'Connection test completed.',
    };
  }

  return {
    success: Boolean(record.success ?? true),
    message: getString(record, ['message']) ?? 'Connection test completed.',
  };
}

export async function revealSenderAccountSmtpPassword(id: string): Promise<string> {
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: `/sender-accounts/${id}/reveal-smtp-password`,
  });

  const record = getRecord(payload);
  const smtpPass = record ? getString(record, ['smtpPass']) : undefined;

  if (!smtpPass) {
    throw new Error('Unable to load SMTP password.');
  }

  return smtpPass;
}
