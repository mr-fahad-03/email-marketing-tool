export interface TemplateImageFolderResponse {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TemplateImageFileResponse {
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
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TemplateImageBreadcrumbItem {
  id: string | null;
  name: string;
}

export interface TemplateImageStorageSummary {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

export interface TemplateImageBrowserResponse {
  currentFolderId: string | null;
  breadcrumbs: TemplateImageBreadcrumbItem[];
  folders: TemplateImageFolderResponse[];
  files: TemplateImageFileResponse[];
  storage: TemplateImageStorageSummary;
}
