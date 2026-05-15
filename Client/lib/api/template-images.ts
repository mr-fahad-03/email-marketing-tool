import { apiRequest } from "@/lib/api/fetcher";
import { env } from "@/lib/config/env";
import type {
  TemplateImageBrowserResult,
  TemplateImageFile,
  TemplateImageFolder,
} from "@/lib/types/template-image";

function getRecord(input: unknown): Record<string, unknown> | null {
  if (input !== null && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return null;
}

function getString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function getNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function toArray<T>(value: unknown, mapper: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(mapper);
}

function toAbsolutePublicUrl(url: string): string {
  const normalized = url.trim();
  if (!normalized) {
    return normalized;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const apiOrigin = new URL(env.apiUrl).origin;
  return new URL(
    normalized.startsWith("/") ? normalized : `/${normalized}`,
    apiOrigin,
  ).toString();
}

function normalizeFolder(input: unknown): TemplateImageFolder {
  const record = getRecord(input);
  if (!record) {
    throw new Error("Invalid folder payload.");
  }

  return {
    id: getString(record, ["id", "_id"]) ?? "",
    workspaceId: getString(record, ["workspaceId"]) ?? "",
    parentId: getString(record, ["parentId"]) ?? null,
    name: getString(record, ["name"]) ?? "Untitled",
    createdAt: getString(record, ["createdAt"]),
    updatedAt: getString(record, ["updatedAt"]),
  };
}

function normalizeFile(input: unknown): TemplateImageFile {
  const record = getRecord(input);
  if (!record) {
    throw new Error("Invalid file payload.");
  }

  const publicUrlRaw =
    getString(record, ["publicUrl"]) ?? getString(record, ["publicPath"]) ?? "";

  return {
    id: getString(record, ["id", "_id"]) ?? "",
    workspaceId: getString(record, ["workspaceId"]) ?? "",
    folderId: getString(record, ["folderId"]) ?? null,
    originalName: getString(record, ["originalName"]) ?? "",
    storedName: getString(record, ["storedName"]) ?? "",
    mimeType: getString(record, ["mimeType"]) ?? "",
    sizeBytes: getNumber(record, ["sizeBytes"]) ?? 0,
    relativePath: getString(record, ["relativePath"]) ?? "",
    publicPath: getString(record, ["publicPath"]) ?? "",
    publicUrl: toAbsolutePublicUrl(publicUrlRaw),
    createdAt: getString(record, ["createdAt"]),
    updatedAt: getString(record, ["updatedAt"]),
  };
}

export async function getTemplateImageBrowser(
  params: {
    folderId?: string | null;
    search?: string;
  } = {},
): Promise<TemplateImageBrowserResult> {
  const payload = await apiRequest<unknown>({
    method: "GET",
    url: "/template-images/browser",
    params: {
      folderId: params.folderId || undefined,
      search: params.search?.trim() || undefined,
    },
  });

  const record = getRecord(payload) ?? {};
  const storage = getRecord(record.storage) ?? {};

  return {
    currentFolderId: getString(record, ["currentFolderId"]) ?? null,
    breadcrumbs: toArray(record.breadcrumbs, (item) => {
      const breadcrumb = getRecord(item) ?? {};
      return {
        id: getString(breadcrumb, ["id"]) ?? null,
        name: getString(breadcrumb, ["name"]) ?? "Folder",
      };
    }),
    folders: toArray(record.folders, normalizeFolder),
    files: toArray(record.files, normalizeFile),
    storage: {
      totalBytes: getNumber(storage, ["totalBytes"]) ?? 0,
      usedBytes: getNumber(storage, ["usedBytes"]) ?? 0,
      freeBytes: getNumber(storage, ["freeBytes"]) ?? 0,
    },
  };
}

export async function createTemplateImageFolder(input: {
  name: string;
  parentId?: string | null;
}): Promise<TemplateImageFolder> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: "POST",
    url: "/template-images/folders",
    data: {
      name: input.name,
      parentId: input.parentId || undefined,
    },
  });

  return normalizeFolder(payload);
}

export async function uploadTemplateImage(input: {
  file: File;
  folderId?: string | null;
}): Promise<TemplateImageFile> {
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.folderId) {
    formData.append("folderId", input.folderId);
  }

  const payload = await apiRequest<unknown, FormData>({
    method: "POST",
    url: "/template-images/upload",
    data: formData,
    // Let the browser/axios set multipart boundaries. A bare `multipart/form-data`
    // header (or default `application/json` from the shared client) breaks Multer.
    transformRequest: [
      (data, headers) => {
        if (data instanceof FormData) {
          delete headers["Content-Type"];
        }
        return data;
      },
    ],
  });

  return normalizeFile(payload);
}

export async function deleteTemplateImageFile(id: string): Promise<void> {
  await apiRequest<unknown>({
    method: "DELETE",
    url: `/template-images/files/${encodeURIComponent(id)}`,
  });
}

export async function moveTemplateImageFile(input: {
  id: string;
  folderId?: string | null;
}): Promise<TemplateImageFile> {
  const payload = await apiRequest<unknown, Record<string, unknown>>({
    method: "PATCH",
    url: `/template-images/files/${encodeURIComponent(input.id)}/move`,
    data: {
      folderId: input.folderId || undefined,
    },
  });

  return normalizeFile(payload);
}

export async function deleteTemplateImageFolder(id: string): Promise<void> {
  await apiRequest<unknown>({
    method: "DELETE",
    url: `/template-images/folders/${encodeURIComponent(id)}`,
  });
}
