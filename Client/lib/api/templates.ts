import { apiRequest } from '@/lib/api/fetcher';
import { clampPageLimit } from '@/lib/api/pagination';
import { env } from '@/lib/config/env';
import { extractTemplateVariablesFromParts } from '@/lib/template-utils';
import type {
  TemplateEditorType,
  MarketingTemplate,
  ProviderStatus,
  ProviderTemplateDetail,
  ProviderTemplateListItem,
  ProviderTemplateListResult,
  TemplatePreviewResult,
  TemplatesListResult,
  TemplatesPagination,
  TemplatesQueryFilters,
} from '@/lib/types/template';
import type { TemplateFormValues } from '@/lib/validators/template';

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

function normalizeTemplate(input: unknown): MarketingTemplate {
  const record = getRecord(input);
  if (!record) {
    throw new Error('Invalid template payload.');
  }

  const id = getString(record, ['id', '_id']);
  const name = getString(record, ['name']);
  if (!id || !name) {
    throw new Error('Template payload is missing required fields.');
  }

  const typeRaw = getString(record, ['channelType', 'type', 'channel']) ?? 'email';
  const type = typeRaw === 'whatsapp' ? 'whatsapp' : 'email';
  const editorTypeRaw = getString(record, ['editorType']) ?? 'html';
  const editorType: TemplateEditorType = editorTypeRaw === 'layout' ? 'layout' : 'html';

  const subject = getString(record, ['subject', 'templateName']) ?? '';

  const body =
    getString(record, ['body', 'htmlBody', 'textBody']) ??
    toStringArray(record.bodyParams).join('\n');

  const variables =
    toStringArray(record.variables).length > 0
      ? toStringArray(record.variables)
      : extractTemplateVariablesFromParts([subject, body]);

  return {
    id,
    workspaceId: getString(record, ['workspaceId']),
    type,
    editorType,
    layoutPreset: getString(record, ['layoutPreset']) as MarketingTemplate['layoutPreset'],
    designJson: getRecord(record.designJson),
    mjmlBody: getString(record, ['mjmlBody']) ?? null,
    category: getString(record, ['category']) as MarketingTemplate['category'],
    visibility: getString(record, ['visibility']) as MarketingTemplate['visibility'],
    name,
    subject,
    body,
    variables,
    status: getString(record, ['status']),
    createdAt: getString(record, ['createdAt']),
    updatedAt: getString(record, ['updatedAt']),
  };
}

function parsePagination(record: Record<string, unknown>, fallbackLimit: number): TemplatesPagination {
  const pagination = getRecord(record.pagination);

  return {
    page: getNumber(pagination ?? {}, ['page']) ?? 1,
    limit: getNumber(pagination ?? {}, ['limit']) ?? fallbackLimit,
    total: getNumber(pagination ?? {}, ['total']) ?? 0,
    totalPages: getNumber(pagination ?? {}, ['totalPages']) ?? 1,
  };
}

function buildPayload(
  values: TemplateFormValues,
  options: { includeChannelType?: boolean } = {},
): Record<string, unknown> {
  const includeChannelType = options.includeChannelType ?? true;
  const variables = extractTemplateVariablesFromParts([values.subject, values.body]);

  if (values.type === 'email') {
    return {
      name: values.name.trim(),
      ...(includeChannelType ? { channelType: 'email' } : {}),
      subject: values.subject.trim(),
      previewText: '',
      htmlBody: values.body,
      textBody: values.body,
      visibility: 'personal',
      category: values.category,
      editorType: values.editorType,
      layoutPreset: values.layoutPreset ?? undefined,
      designJson: values.editorType === 'layout' ? values.designJson ?? null : null,
      mjmlBody: values.editorType === 'layout' ? values.mjmlBody ?? null : null,
      variables,
      status: values.status || 'active',
    };
  }

  return {
    name: values.name.trim(),
    ...(includeChannelType ? { channelType: 'whatsapp' } : {}),
    templateName: values.subject.trim(),
    language: 'en',
    visibility: 'personal',
    category: values.category,
    editorType: 'html',
    layoutPreset: undefined,
    variables,
    bodyParams: values.body ? [values.body] : [],
    headerParams: [],
    buttonParams: [],
    status: values.status || 'active',
  };
}

function normalizeAssetUrl(value: string): string {
  if (!value || /^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return `${env.apiUrl}${value}`;
  }

  return value;
}

export async function getTemplates(filters: TemplatesQueryFilters = {}): Promise<TemplatesListResult> {
  const limit = clampPageLimit(filters.limit, 10);

  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/templates',
    params: {
      page: filters.page ?? 1,
      limit,
      search: filters.search || undefined,
      channelType: filters.type || undefined,
      category: filters.category || undefined,
      visibility: filters.visibility || undefined,
      editorType: filters.editorType || undefined,
    },
  });

  if (Array.isArray(payload)) {
    return {
      items: payload.map(normalizeTemplate),
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
    items: itemsRaw.map(normalizeTemplate),
    pagination: parsePagination(record, limit),
  };
}

export async function getTemplateById(id: string): Promise<MarketingTemplate> {
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: `/templates/${id}`,
  });

  return normalizeTemplate(payload);
}

export async function createTemplate(values: TemplateFormValues): Promise<MarketingTemplate> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'POST',
    url: '/templates',
    data: buildPayload(values, { includeChannelType: true }),
  });

  return normalizeTemplate(payload);
}

export async function updateTemplate(id: string, values: TemplateFormValues): Promise<MarketingTemplate> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'PATCH',
    url: `/templates/${id}`,
    data: buildPayload(values, { includeChannelType: false }),
  });

  return normalizeTemplate(payload);
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiRequest<unknown>({
    method: 'DELETE',
    url: `/templates/${id}`,
  });
}

export async function previewTemplate(id: string): Promise<TemplatePreviewResult> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: 'POST',
    url: `/templates/${id}/preview`,
    data: {},
  });

  const record = getRecord(payload);
  const rendered = getRecord(record?.rendered) ?? {};

  const subject =
    getString(rendered, ['subject', 'templateName']) ??
    getString(record ?? {}, ['name']) ??
    '';

  const bodyFromRendered =
    getString(rendered, ['htmlBody', 'textBody']) ??
    toStringArray(rendered.bodyParams).join('\n');

  return {
    subject,
    body: bodyFromRendered,
    unresolvedVariables: toStringArray(record?.unresolvedVariables),
  };
}

function normalizeProviderTemplateListItem(input: unknown): ProviderTemplateListItem {
  const record = getRecord(input);
  if (!record) {
    throw new Error('Invalid provider template payload.');
  }

  return {
    provider: 'mjml',
    templateId: getString(record, ['templateId']) ?? '',
    name: getString(record, ['name']) ?? '',
    thumbnail: normalizeAssetUrl(getString(record, ['thumbnail']) ?? ''),
    categoryHints: toStringArray(record.categoryHints),
  };
}

function normalizeMjmlErrors(
  value: unknown,
): Array<{
  message: string;
  tagName?: string;
  formattedMessage?: string;
  line?: number;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  const errors: Array<{
    message: string;
    tagName?: string;
    formattedMessage?: string;
    line?: number;
  }> = [];

  for (const entry of value) {
    const item = getRecord(entry);
    if (!item) {
      continue;
    }

    const message = getString(item, ['message']);
    if (!message) {
      continue;
    }

    const normalized: {
      message: string;
      tagName?: string;
      formattedMessage?: string;
      line?: number;
    } = { message };

    const tagName = getString(item, ['tagName']);
    const formattedMessage = getString(item, ['formattedMessage']);
    const line = getNumber(item, ['line']);

    if (tagName) {
      normalized.tagName = tagName;
    }
    if (formattedMessage) {
      normalized.formattedMessage = formattedMessage;
    }
    if (typeof line === 'number') {
      normalized.line = line;
    }

    errors.push(normalized);
  }

  return errors;
}

function normalizeProviderTemplateDetail(input: unknown): ProviderTemplateDetail {
  const record = getRecord(input);
  if (!record) {
    throw new Error('Invalid provider template detail payload.');
  }

  const base = normalizeProviderTemplateListItem(record);

  return {
    ...base,
    html: getString(record, ['html']) ?? '',
    mjml: getString(record, ['mjml']) ?? '',
    engine: getString(record, ['engine']) === 'api' ? 'api' : 'local',
    errors: normalizeMjmlErrors(record.errors),
  };
}

export async function getMjmlProviderStatus(): Promise<ProviderStatus> {
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/templates/library/providers/mjml/status',
  });

  const record = getRecord(payload);
  return {
    provider: 'mjml',
    enabled: Boolean(record?.enabled),
    configured: Boolean(record?.configured),
    renderMode:
      getString(record ?? {}, ['renderMode']) === 'api_only'
        ? 'api_only'
        : getString(record ?? {}, ['renderMode']) === 'local_only'
          ? 'local_only'
          : 'hybrid',
    apiReachable:
      typeof record?.apiReachable === 'boolean' ? (record.apiReachable as boolean) : null,
    fallbackToLocal: Boolean(record?.fallbackToLocal),
    message: getString(record ?? {}, ['message']) ?? 'Unknown provider state',
  };
}

export async function getMjmlProviderTemplates(filters: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
} = {}): Promise<ProviderTemplateListResult> {
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: '/templates/library/providers/mjml/templates',
    params: filters,
  });

  const record = getRecord(payload);
  const itemsRaw = Array.isArray(record?.items) ? record.items : [];

  return {
    provider: 'mjml',
    total: getNumber(record ?? {}, ['total']) ?? itemsRaw.length,
    items: itemsRaw.map(normalizeProviderTemplateListItem),
  };
}

export async function getMjmlProviderTemplateById(templateId: string): Promise<ProviderTemplateDetail> {
  const payload = await apiRequest<unknown>({
    method: 'GET',
    url: `/templates/library/providers/mjml/templates/${templateId}`,
  });

  return normalizeProviderTemplateDetail(payload);
}

export async function renderMjmlTemplate(mjml: string): Promise<{
  html: string;
  mjml: string;
  engine: 'api' | 'local';
  errors: Array<{
    message: string;
    tagName?: string;
    formattedMessage?: string;
    line?: number;
  }>;
}> {
  const payload = await apiRequest<unknown, { mjml: string }>({
    method: 'POST',
    url: '/templates/library/providers/mjml/render',
    data: { mjml },
  });

  const record = getRecord(payload);
  return {
    html: getString(record ?? {}, ['html']) ?? '',
    mjml: getString(record ?? {}, ['mjml']) ?? mjml,
    engine: getString(record ?? {}, ['engine']) === 'api' ? 'api' : 'local',
    errors: normalizeMjmlErrors(record?.errors),
  };
}
