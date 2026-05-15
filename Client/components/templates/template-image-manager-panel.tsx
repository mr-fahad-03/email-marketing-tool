"use client";

import {
  Copy,
  Folder,
  FolderPlus,
  Home,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { toast } from "sonner";
import {
  createTemplateImageFolder,
  deleteTemplateImageFile,
  deleteTemplateImageFolder,
  getTemplateImageBrowser,
  moveTemplateImageFile,
  uploadTemplateImage,
} from "@/lib/api/template-images";
import { HttpClientError } from "@/lib/api/errors";
import type {
  TemplateImageBrowserResult,
  TemplateImageFile,
} from "@/lib/types/template-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface TemplateImageManagerPanelProps {
  showSelectAction?: boolean;
  onSelectImage?: (imageUrl: string, file: TemplateImageFile) => void;
}

type PendingDeleteTarget =
  | {
      type: "folder";
      id: string;
      name: string;
    }
  | {
      type: "file";
      id: string;
      name: string;
    };

function encodePublicImageUrlForDisplay(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  try {
    const parsed = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, "http://local.invalid");

    parsed.pathname = parsed.pathname
      .split("/")
      .map((segment) => {
        if (!segment) {
          return segment;
        }
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return encodeURIComponent(segment);
        }
      })
      .join("/");

    if (/^https?:\/\//i.test(trimmed)) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return trimmed;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
}

export function TemplateImageManagerPanel({
  showSelectAction = false,
  onSelectImage,
}: TemplateImageManagerPanelProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isDeletingFileId, setIsDeletingFileId] = useState<string | null>(null);
  const [isDeletingFolderId, setIsDeletingFolderId] = useState<string | null>(
    null,
  );
  const [isMovingFileId, setIsMovingFileId] = useState<string | null>(null);
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] =
    useState<PendingDeleteTarget | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [browser, setBrowser] = useState<TemplateImageBrowserResult | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadBrowser = useCallback(
    async (folderId: string | null, search: string) => {
      setIsLoading(true);
      try {
        const result = await getTemplateImageBrowser({
          folderId,
          search,
        });
        setBrowser(result);
        setCurrentFolderId(result.currentFolderId);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadBrowser(currentFolderId, searchQuery);
  }, [currentFolderId, loadBrowser, searchQuery]);

  const usedPercent = useMemo(() => {
    if (!browser || browser.storage.totalBytes <= 0) {
      return 0;
    }

    return Math.min(
      100,
      (browser.storage.usedBytes / browser.storage.totalBytes) * 100,
    );
  }, [browser]);
  const breadcrumbs = browser?.breadcrumbs ?? [];
  const folders = browser?.folders ?? [];
  const files = browser?.files ?? [];

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadTemplateImage({
        file: selected,
        folderId: currentFolderId,
      });
      toast.success("Image uploaded successfully.");
      if (showSelectAction && onSelectImage) {
        onSelectImage(uploaded.publicUrl, uploaded);
      } else {
        await loadBrowser(currentFolderId, searchQuery);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleCreateFolder = async () => {
    const input = window.prompt("Folder name");
    if (!input) {
      return;
    }

    const name = input.trim();
    if (!name) {
      toast.error("Folder name cannot be empty.");
      return;
    }

    setIsCreatingFolder(true);
    try {
      await createTemplateImageFolder({
        name,
        parentId: currentFolderId,
      });
      toast.success("Folder created.");
      await loadBrowser(currentFolderId, searchQuery);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    setPendingDeleteTarget({
      type: "folder",
      id: folderId,
      name: folderName,
    });
  };

  const handleDeleteFile = (file: TemplateImageFile) => {
    setPendingDeleteTarget({
      type: "file",
      id: file.id,
      name: file.originalName,
    });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteTarget) {
      return;
    }

    setIsConfirmingDelete(true);
    try {
      if (pendingDeleteTarget.type === "folder") {
        setIsDeletingFolderId(pendingDeleteTarget.id);
        await deleteTemplateImageFolder(pendingDeleteTarget.id);
        toast.success("Folder deleted.");
      } else {
        setIsDeletingFileId(pendingDeleteTarget.id);
        await deleteTemplateImageFile(pendingDeleteTarget.id);
        toast.success("Image deleted.");
      }

      await loadBrowser(currentFolderId, searchQuery);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeletingFileId(null);
      setIsDeletingFolderId(null);
      setPendingDeleteTarget(null);
      setIsConfirmingDelete(false);
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Image URL copied.");
    } catch {
      toast.error("Could not copy image URL.");
    }
  };

  const handleMoveFileToFolder = async (
    file: TemplateImageFile,
    destinationFolderId: string,
  ) => {
    if (file.folderId === destinationFolderId) {
      toast.error("Image is already in this folder.");
      return;
    }

    setIsMovingFileId(file.id);
    try {
      await moveTemplateImageFile({
        id: file.id,
        folderId: destinationFolderId,
      });
      toast.success("Image moved.");
      await loadBrowser(currentFolderId, searchQuery);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsMovingFileId(null);
      setDraggingFileId(null);
      setDragOverFolderId(null);
    }
  };

  const handleFileDragStart = (
    event: DragEvent<HTMLDivElement>,
    file: TemplateImageFile,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", file.id);
    setDraggingFileId(file.id);
  };

  const handleFolderDragOver = (
    event: DragEvent<HTMLDivElement>,
    folderId: string,
  ) => {
    if (!draggingFileId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  };

  const handleFolderDrop = (
    event: DragEvent<HTMLDivElement>,
    destinationFolderId: string,
  ) => {
    event.preventDefault();
    const draggedFileId = event.dataTransfer.getData("text/plain");
    const draggedFile = files.find((item) => item.id === draggedFileId);
    if (!draggedFile) {
      setDragOverFolderId(null);
      return;
    }

    void handleMoveFileToFolder(draggedFile, destinationFolderId);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-600">
              Total:{" "}
              <span className="font-semibold text-zinc-800">
                {formatBytes(browser?.storage.totalBytes ?? 0)}
              </span>
              {"  "} | Free:{" "}
              <span className="font-semibold text-zinc-800">
                {formatBytes(browser?.storage.freeBytes ?? 0)}
              </span>
              {"  "} | Taken:{" "}
              <span className="font-semibold text-zinc-800">
                {formatBytes(browser?.storage.usedBytes ?? 0)}
              </span>
            </div>
            <div className="mt-2 h-2 w-full max-w-xl overflow-hidden rounded bg-zinc-200">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>

          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="text filter..."
            className="w-full max-w-xs"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCreateFolder()}
            disabled={isCreatingFolder}
          >
            {isCreatingFolder ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderPlus className="h-4 w-4" />
            )}
            New Folder
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={(event) => void handleUploadChange(event)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div
              key={`${crumb.id ?? "root"}-${index}`}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-zinc-700 hover:bg-zinc-100"
                onClick={() => setCurrentFolderId(crumb.id)}
              >
                {crumb.id ? (
                  <Folder className="h-4 w-4" />
                ) : (
                  <Home className="h-4 w-4" />
                )}
                {crumb.name}
              </button>
              {index < breadcrumbs.length - 1 ? (
                <span className="text-zinc-400">/</span>
              ) : null}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-zinc-500">
              ({files.length} Files - {folders.length} Folders)
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    dragOverFolderId === folder.id
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-zinc-200 bg-zinc-50"
                  }`}
                  onDragOver={(event) => handleFolderDragOver(event, folder.id)}
                  onDragLeave={() =>
                    setDragOverFolderId((activeFolderId) =>
                      activeFolderId === folder.id ? null : activeFolderId,
                    )
                  }
                  onDrop={(event) => handleFolderDrop(event, folder.id)}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setCurrentFolderId(folder.id)}
                  >
                    <div className="mb-3 grid h-24 place-items-center rounded bg-amber-100">
                      <Folder className="h-10 w-10 text-amber-600" />
                    </div>
                    <p
                      className="truncate text-sm font-medium text-zinc-800"
                      title={folder.name}
                    >
                      {folder.name}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => handleDeleteFolder(folder.id, folder.name)}
                    disabled={isDeletingFolderId === folder.id}
                  >
                    {isDeletingFolderId === folder.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete Folder
                  </Button>
                </div>
              ))}

              {files.map((file) => (
                <div
                  key={file.id}
                  className={`rounded-lg border border-zinc-200 bg-white p-2 ${
                    draggingFileId === file.id ? "opacity-60" : ""
                  }`}
                  draggable={isMovingFileId !== file.id}
                  onDragStart={(event) => handleFileDragStart(event, file)}
                  onDragEnd={() => {
                    setDraggingFileId(null);
                    setDragOverFolderId(null);
                  }}
                >
                  <div className="mb-2 h-28 overflow-hidden rounded border border-zinc-200 bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={encodePublicImageUrlForDisplay(file.publicUrl)}
                      alt={file.originalName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p
                    className="truncate text-xs text-zinc-700"
                    title={file.originalName}
                  >
                    {file.originalName}
                  </p>
                  {!showSelectAction ? (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => void handleCopyUrl(file.publicUrl)}
                        disabled={isMovingFileId === file.id}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => handleDeleteFile(file)}
                        disabled={
                          isDeletingFileId === file.id || isMovingFileId === file.id
                        }
                      >
                        {isDeletingFileId === file.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </Button>
                    </div>
                  ) : null}
                  {showSelectAction ? (
                    <div className="mt-1 flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 flex-1 text-xs"
                        onClick={() => onSelectImage?.(file.publicUrl, file)}
                        disabled={isMovingFileId === file.id}
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        Use Image
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => handleDeleteFile(file)}
                        disabled={
                          isDeletingFileId === file.id || isMovingFileId === file.id
                        }
                        aria-label={`Delete ${file.originalName}`}
                      >
                        {isDeletingFileId === file.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {!folders.length && !files.length ? (
              <div className="mt-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                No folders or images found in this location.
              </div>
            ) : null}
          </>
        )}
      </div>

      <Dialog
        open={Boolean(pendingDeleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isConfirmingDelete) {
            setPendingDeleteTarget(null);
          }
        }}
      >
        <DialogContent
          showClose={false}
          overlayClassName="z-[11000] bg-black/40"
          className="z-[11010] max-w-md border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl"
          onPointerDownOutside={(event) => {
            if (isConfirmingDelete) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-semibold text-zinc-900">
              Confirm Delete
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-600">
              {pendingDeleteTarget?.type === "folder"
                ? `Delete folder "${pendingDeleteTarget.name}"? It must be empty.`
                : `Delete image "${pendingDeleteTarget?.name ?? ""}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDeleteTarget(null)}
              disabled={isConfirmingDelete}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isConfirmingDelete}
            >
              {isConfirmingDelete ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
