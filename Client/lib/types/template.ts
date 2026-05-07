export type TemplateType = 'email' | 'whatsapp';
export type TemplateEditorType = 'layout' | 'html';
export type TemplateVisibility = 'personal';
export type TemplateDesignJson = Record<string, unknown>;
export type TemplateCategory =
  | 'business'
  | 'online-store'
  | 'kitchen'
  | 'medicine'
  | 'education'
  | 'general'
  | 'holidays'
  | 'tourism'
  | 'marketing'
  | 'transactional'
  | 'utility'
  | 'authentication';
export type TemplateLayoutPreset =
  | 'empty'
  | 'basic'
  | 'commerce'
  | 'three-columns'
  | 'news'
  | 'text';

export interface MarketingTemplate {
  id: string;
  workspaceId?: string;
  type: TemplateType;
  editorType?: TemplateEditorType;
  layoutPreset?: TemplateLayoutPreset | null;
  designJson?: TemplateDesignJson | null;
  mjmlBody?: string | null;
  category?: TemplateCategory;
  visibility?: TemplateVisibility;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplatesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TemplatesListResult {
  items: MarketingTemplate[];
  pagination: TemplatesPagination;
}

export interface TemplatesQueryFilters {
  search?: string;
  type?: TemplateType;
  category?: TemplateCategory;
  visibility?: TemplateVisibility;
  editorType?: TemplateEditorType;
  page?: number;
  limit?: number;
}

export interface TemplatePreviewResult {
  subject: string;
  body: string;
  unresolvedVariables: string[];
}

export interface ProviderTemplateListItem {
  provider: 'mjml';
  templateId: string;
  name: string;
  thumbnail: string;
  categoryHints: string[];
}

export interface ProviderTemplateDetail extends ProviderTemplateListItem {
  html: string;
  mjml: string;
  engine: 'api' | 'local';
  errors: Array<{
    message: string;
    tagName?: string;
    formattedMessage?: string;
    line?: number;
  }>;
}

export interface ProviderTemplateListResult {
  provider: 'mjml';
  total: number;
  items: ProviderTemplateListItem[];
}

export interface ProviderStatus {
  provider: 'mjml';
  enabled: boolean;
  configured: boolean;
  renderMode: 'hybrid' | 'api_only' | 'local_only';
  apiReachable: boolean | null;
  fallbackToLocal: boolean;
  message: string;
}
