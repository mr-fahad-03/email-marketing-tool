export interface TemplateImageFolder {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateImageFile {
  id: string;
  workspaceId: string;
  folderId: string | null;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
  publicPath: string;
  publicUrl: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateImageStorageSummary {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

export interface TemplateImageBreadcrumbItem {
  id: string | null;
  name: string;
}

export interface TemplateImageBrowserResult {
  currentFolderId: string | null;
  breadcrumbs: TemplateImageBreadcrumbItem[];
  folders: TemplateImageFolder[];
  files: TemplateImageFile[];
  storage: TemplateImageStorageSummary;
}
