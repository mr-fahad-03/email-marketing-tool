import {
  ContactEmailStatus,
  ContactSource,
  ContactSubscriptionStatus,
  ContactWhatsappStatus,
} from '../constants/contact.enums';

export interface ContactResponse {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string;
  category: string;
  labels: string[];
  customFields: Record<string, unknown>;
  emailStatus: ContactEmailStatus;
  whatsappStatus: ContactWhatsappStatus;
  subscriptionStatus: ContactSubscriptionStatus;
  source: ContactSource;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ContactListResponse {
  items: ContactResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ContactImportResultResponse {
  created: number;
  skipped: number;
  invalid: number;
  total: number;
  queuedJob?: {
    id: string;
    status: 'queued';
    note: string;
  };
  invalidRows?: Array<{
    row: number;
    reason: string;
  }>;
  skippedRows?: Array<{
    row: number;
    name: string;
    email: string;
    phone: string;
    company: string;
    reason: string;
  }>;
}

export interface ContactCategorySummaryItemResponse {
  category: string;
  count: number;
}

export interface ContactCategorySummaryResponse {
  total: number;
  categories: ContactCategorySummaryItemResponse[];
}
