import {
  TemplateCategory,
  TemplateChannelType,
  TemplateEditorType,
  TemplateLayoutPreset,
  TemplateStatus,
  TemplateVisibility,
} from '../constants/template.enums';

interface TemplateBaseResponse {
  id: string;
  workspaceId: string;
  channelType: TemplateChannelType;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
  visibility: TemplateVisibility;
  editorType: TemplateEditorType;
  layoutPreset: TemplateLayoutPreset | null;
  variables: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EmailTemplateResponse extends TemplateBaseResponse {
  channelType: TemplateChannelType.EMAIL;
  subject: string;
  previewText: string;
  htmlBody: string;
  textBody: string;
  designJson: Record<string, unknown> | null;
  mjmlBody: string | null;
}

export interface WhatsAppTemplateResponse extends TemplateBaseResponse {
  channelType: TemplateChannelType.WHATSAPP;
  templateName: string;
  language: string;
  bodyParams: string[];
  headerParams: string[];
  buttonParams: string[];
}

export type TemplateResponse = EmailTemplateResponse | WhatsAppTemplateResponse;

export interface TemplateListResponse {
  items: TemplateResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface TemplatePreviewResponse {
  templateId: string;
  channelType: TemplateChannelType;
  rendered: Record<string, unknown>;
  sampleData: Record<string, unknown>;
  unresolvedVariables: string[];
}

export interface MjmlProviderStatusResponse {
  provider: 'mjml';
  enabled: boolean;
  configured: boolean;
  renderMode: 'hybrid' | 'api_only' | 'local_only';
  apiReachable: boolean | null;
  fallbackToLocal: boolean;
  message: string;
}

export interface MjmlProviderTemplateError {
  message: string;
  tagName?: string;
  formattedMessage?: string;
  line?: number;
}

export interface ProviderTemplateListItem {
  provider: 'mjml';
  templateId: string;
  name: string;
  thumbnail: string;
  categoryHints: string[];
}

export interface ProviderTemplateListResponse {
  provider: 'mjml';
  total: number;
  items: ProviderTemplateListItem[];
}

export interface ProviderTemplateDetailResponse extends ProviderTemplateListItem {
  html: string;
  mjml: string;
  engine: 'api' | 'local';
  errors: MjmlProviderTemplateError[];
}

export interface MjmlRenderResponse {
  html: string;
  mjml: string;
  engine: 'api' | 'local';
  errors: MjmlProviderTemplateError[];
}
