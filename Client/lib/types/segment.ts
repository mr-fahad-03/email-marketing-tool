export type SegmentType = 'static' | 'dynamic';

export interface SegmentFilters {
  tags: string[];
  status: string[];
}

export interface Segment {
  id: string;
  workspaceId?: string;
  name: string;
  description?: string;
  type: SegmentType;
  filters: SegmentFilters;
  contactIds: string[];
  estimatedCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SegmentsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SegmentsListResult {
  items: Segment[];
  pagination: SegmentsPagination;
}

export interface SegmentQueryFilters {
  search?: string;
  tag?: string;
  status?: string;
  page?: number;
  limit?: number;
}
