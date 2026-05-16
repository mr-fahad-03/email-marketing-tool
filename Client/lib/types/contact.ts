export type ContactStatus = 'active' | 'inactive' | 'subscribed' | 'unsubscribed' | 'pending';

export interface Contact {
  id: string;
  workspaceId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  category?: string;
  labels: string[];
  customFields?: Record<string, unknown>;
  emailStatus?: string;
  whatsappStatus?: string;
  subscriptionStatus?: string;
  source?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ContactsListResult {
  items: Contact[];
  pagination: ContactsPagination;
}

export interface ContactFilters {
  search?: string;
  contactName?: string;
  email?: string;
  company?: string;
  country?: string;
  city?: string;
  telephone?: string;
  mobile?: string;
  additionalNumber?: string;
  designation?: string;
  department?: string;
  leadSource?: string;
  category?: string;
  labels?: string[];
  status?: string;
  page?: number;
  limit?: number;
}

export interface ContactsImportInvalidRow {
  row: number;
  reason: string;
}

export interface ContactsImportSkippedRow {
  row: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  reason: string;
}

export interface ContactsImportResult {
  created: number;
  skipped: number;
  invalid: number;
  total: number;
  message?: string;
  invalidRows?: ContactsImportInvalidRow[];
  skippedRows?: ContactsImportSkippedRow[];
}

export interface ContactCategorySummaryItem {
  category: string;
  count: number;
}

export interface ContactCategorySummaryResult {
  total: number;
  categories: ContactCategorySummaryItem[];
}

