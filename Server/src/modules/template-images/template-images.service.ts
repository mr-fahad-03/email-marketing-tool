import { mkdir, rename, rm, unlink, writeFile } from 'fs/promises';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { extname, isAbsolute, join, posix as pathPosix } from 'path';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthUser } from '../../common/types/auth-user.type';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateTemplateImageFolderDto } from './dto/create-template-image-folder.dto';
import { ListTemplateImagesDto } from './dto/list-template-images.dto';
import { MoveTemplateImageFileDto } from './dto/move-template-image-file.dto';
import { UploadTemplateImageDto } from './dto/upload-template-image.dto';
import { TemplateImageFile, TemplateImageFileDocument } from './schemas/template-image-file.schema';
import {
  TemplateImageFolder,
  TemplateImageFolderDocument,
} from './schemas/template-image-folder.schema';
import {
  TemplateImageBrowserResponse,
  TemplateImageFileResponse,
  TemplateImageFolderResponse,
  TemplateImageStorageSummary,
} from './types/template-image.response';

interface TemplateImageSettings {
  uploadDir: string;
  publicPath: string;
  publicBaseUrl: string;
  quotaBytes: number;
  maxFileBytes: number;
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

@Injectable()
export class TemplateImagesService {
  constructor(
    @InjectModel(TemplateImageFolder.name)
    private readonly templateImageFolderModel: Model<TemplateImageFolder>,
    @InjectModel(TemplateImageFile.name)
    private readonly templateImageFileModel: Model<TemplateImageFile>,
    private readonly configService: ConfigService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async browse(
    query: ListTemplateImagesDto,
    authUser: AuthUser,
  ): Promise<TemplateImageBrowserResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const folder = await this.resolveOwnedFolder(query.folderId, workspaceId, {
      allowRoot: true,
      notFoundCode: 'TEMPLATE_IMAGE_FOLDER_NOT_FOUND',
    });

    const folderFilter: Record<string, unknown> = {
      workspaceId: this.toObjectId(workspaceId),
      parentId: folder ? folder._id : null,
    };

    const fileFilter: Record<string, unknown> = {
      workspaceId: this.toObjectId(workspaceId),
      folderId: folder ? folder._id : null,
    };

    if (query.search?.trim()) {
      const pattern = new RegExp(this.escapeRegex(query.search.trim()), 'i');
      fileFilter.$or = [{ originalName: pattern }, { storedName: pattern }];
    }

    const [folders, files, storage] = await Promise.all([
      this.templateImageFolderModel.find(folderFilter).sort({ name: 1 }).exec(),
      this.templateImageFileModel.find(fileFilter).sort({ createdAt: -1 }).exec(),
      this.getStorageSummary(workspaceId),
    ]);

    return {
      currentFolderId: folder?.id ?? null,
      breadcrumbs: await this.buildBreadcrumbs(folder, workspaceId),
      folders: folders.map((item) => this.toFolderResponse(item)),
      files: files.map((item) => this.toFileResponse(item)),
      storage,
    };
  }

  async createFolder(
    dto: CreateTemplateImageFolderDto,
    authUser: AuthUser,
  ): Promise<TemplateImageFolderResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const parent = await this.resolveOwnedFolder(dto.parentId, workspaceId, {
      allowRoot: true,
      notFoundCode: 'TEMPLATE_IMAGE_FOLDER_NOT_FOUND',
    });

    const normalizedName = dto.name.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TEMPLATE_IMAGE_FOLDER_NAME_REQUIRED',
        'Folder name is required',
      );
    }

    try {
      const created = await this.templateImageFolderModel.create({
        workspaceId: this.toObjectId(workspaceId),
        parentId: parent?._id ?? null,
        name: normalizedName,
      });

      return this.toFolderResponse(created);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'TEMPLATE_IMAGE_FOLDER_ALREADY_EXISTS',
          'A folder with this name already exists in the current location',
        );
      }

      throw error;
    }
  }

  async upload(
    file: Express.Multer.File | undefined,
    dto: UploadTemplateImageDto,
    authUser: AuthUser,
  ): Promise<TemplateImageFileResponse> {
    if (!file?.buffer?.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TEMPLATE_IMAGE_FILE_REQUIRED',
        'Image file is required',
      );
    }

    const settings = this.getSettings();

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TEMPLATE_IMAGE_UNSUPPORTED_TYPE',
        'Only JPG, PNG, GIF, WEBP, and SVG images are allowed',
      );
    }

    if (file.size > settings.maxFileBytes) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TEMPLATE_IMAGE_FILE_TOO_LARGE',
        `Image exceeds max upload size of ${Math.round(settings.maxFileBytes / (1024 * 1024))}MB`,
      );
    }

    const workspaceId = await this.resolveWorkspaceId(authUser);
    const folder = await this.resolveOwnedFolder(dto.folderId, workspaceId, {
      allowRoot: true,
      notFoundCode: 'TEMPLATE_IMAGE_FOLDER_NOT_FOUND',
    });

    const storage = await this.getStorageSummary(workspaceId);
    if (storage.usedBytes + file.size > storage.totalBytes) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TEMPLATE_IMAGE_QUOTA_EXCEEDED',
        'Storage quota exceeded. Delete some files before uploading.',
      );
    }

    const originalName = file.originalname?.trim() || 'image';
    const baseName = this.sanitizeBaseName(originalName);
    const extension = this.resolveExtension(originalName, file.mimetype);
    const random = Math.random().toString(36).slice(2, 10);
    const storedName = `${Date.now()}-${random}-${baseName}${extension}`;

    const folderSegment = folder?.id ?? 'root';
    const relativeDir = pathPosix.join(workspaceId, folderSegment);
    const relativePath = pathPosix.join(relativeDir, storedName);
    const absoluteDir = join(settings.uploadDir, ...relativeDir.split('/'));
    const absolutePath = join(settings.uploadDir, ...relativePath.split('/'));

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    const publicPath = `${settings.publicPath}/${relativePath}`.replace(/\/+/g, '/');

    const created = await this.templateImageFileModel.create({
      workspaceId: this.toObjectId(workspaceId),
      folderId: folder?._id ?? null,
      originalName,
      storedName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      relativePath,
      publicPath,
      createdByUserId:
        authUser.sub && Types.ObjectId.isValid(authUser.sub) ? this.toObjectId(authUser.sub) : null,
    });

    return this.toFileResponse(created);
  }

  async removeFile(id: string, authUser: AuthUser): Promise<{ deleted: true; id: string }> {
    const workspaceId = await this.resolveWorkspaceId(authUser);

    const file = await this.templateImageFileModel
      .findOne({
        _id: this.toObjectId(id),
        workspaceId: this.toObjectId(workspaceId),
      })
      .exec();

    if (!file) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'TEMPLATE_IMAGE_FILE_NOT_FOUND',
        'Image file not found',
      );
    }

    await this.templateImageFileModel.deleteOne({ _id: file._id }).exec();

    const absolutePath = join(this.getSettings().uploadDir, ...file.relativePath.split('/'));
    try {
      await unlink(absolutePath);
    } catch {
      // File may already be missing on disk.
    }

    return { deleted: true, id: file.id };
  }

  async removeFolder(id: string, authUser: AuthUser): Promise<{ deleted: true; id: string }> {
    const workspaceId = await this.resolveWorkspaceId(authUser);

    const folder = await this.templateImageFolderModel
      .findOne({
        _id: this.toObjectId(id),
        workspaceId: this.toObjectId(workspaceId),
      })
      .exec();

    if (!folder) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'TEMPLATE_IMAGE_FOLDER_NOT_FOUND',
        'Folder not found',
      );
    }

    const [childFolderCount, childFileCount] = await Promise.all([
      this.templateImageFolderModel
        .countDocuments({
          workspaceId: this.toObjectId(workspaceId),
          parentId: folder._id,
        })
        .exec(),
      this.templateImageFileModel
        .countDocuments({
          workspaceId: this.toObjectId(workspaceId),
          folderId: folder._id,
        })
        .exec(),
    ]);

    if (childFolderCount > 0 || childFileCount > 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'TEMPLATE_IMAGE_FOLDER_NOT_EMPTY',
        'Folder is not empty. Remove child folders and files first.',
      );
    }

    await this.templateImageFolderModel.deleteOne({ _id: folder._id }).exec();

    const absoluteFolderPath = join(this.getSettings().uploadDir, workspaceId, folder.id);
    await rm(absoluteFolderPath, { recursive: true, force: true });

    return { deleted: true, id: folder.id };
  }

  async moveFile(
    id: string,
    dto: MoveTemplateImageFileDto,
    authUser: AuthUser,
  ): Promise<TemplateImageFileResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const [file, destinationFolder] = await Promise.all([
      this.templateImageFileModel
        .findOne({
          _id: this.toObjectId(id),
          workspaceId: this.toObjectId(workspaceId),
        })
        .exec(),
      this.resolveOwnedFolder(dto.folderId, workspaceId, {
        allowRoot: true,
        notFoundCode: 'TEMPLATE_IMAGE_FOLDER_NOT_FOUND',
      }),
    ]);

    if (!file) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'TEMPLATE_IMAGE_FILE_NOT_FOUND',
        'Image file not found',
      );
    }

    const currentFolderId = file.folderId ? file.folderId.toString() : null;
    const nextFolderId = destinationFolder?._id ? destinationFolder._id.toString() : null;
    if (currentFolderId === nextFolderId) {
      return this.toFileResponse(file);
    }

    const settings = this.getSettings();
    const sourceAbsolutePath = join(settings.uploadDir, ...file.relativePath.split('/'));

    const destinationFolderSegment = destinationFolder?.id ?? 'root';
    const destinationRelativeDir = pathPosix.join(workspaceId, destinationFolderSegment);
    const destinationRelativePath = pathPosix.join(destinationRelativeDir, file.storedName);
    const destinationAbsoluteDir = join(settings.uploadDir, ...destinationRelativeDir.split('/'));
    const destinationAbsolutePath = join(settings.uploadDir, ...destinationRelativePath.split('/'));

    await mkdir(destinationAbsoluteDir, { recursive: true });

    try {
      await rename(sourceAbsolutePath, destinationAbsolutePath);
    } catch {
      throw new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'TEMPLATE_IMAGE_FILE_MOVE_FAILED',
        'Could not move image file',
      );
    }

    file.folderId = destinationFolder?._id ?? null;
    file.relativePath = destinationRelativePath;
    file.publicPath = `${settings.publicPath}/${destinationRelativePath}`.replace(/\/+/g, '/');

    await file.save();

    return this.toFileResponse(file);
  }

  private async buildBreadcrumbs(
    folder: TemplateImageFolderDocument | null,
    workspaceId: string,
  ): Promise<Array<{ id: string | null; name: string }>> {
    const breadcrumbs: Array<{ id: string | null; name: string }> = [{ id: null, name: 'Home' }];

    if (!folder) {
      return breadcrumbs;
    }

    const pathItems: TemplateImageFolderDocument[] = [folder];
    let cursor = folder;

    while (cursor.parentId) {
      const parent = await this.templateImageFolderModel
        .findOne({
          _id: cursor.parentId,
          workspaceId: this.toObjectId(workspaceId),
        })
        .exec();

      if (!parent) {
        break;
      }

      pathItems.unshift(parent);
      cursor = parent;
    }

    for (const item of pathItems) {
      breadcrumbs.push({ id: item.id, name: item.name });
    }

    return breadcrumbs;
  }

  private async getStorageSummary(workspaceId: string): Promise<TemplateImageStorageSummary> {
    const settings = this.getSettings();

    const summary = await this.templateImageFileModel
      .aggregate<{ usedBytes: number }>([
        {
          $match: {
            workspaceId: this.toObjectId(workspaceId),
          },
        },
        {
          $group: {
            _id: null,
            usedBytes: { $sum: '$sizeBytes' },
          },
        },
      ])
      .exec();

    const usedBytes = summary[0]?.usedBytes ?? 0;

    return {
      totalBytes: settings.quotaBytes,
      usedBytes,
      freeBytes: Math.max(0, settings.quotaBytes - usedBytes),
    };
  }

  private toFolderResponse(folder: TemplateImageFolderDocument): TemplateImageFolderResponse {
    return {
      id: folder.id,
      workspaceId: folder.workspaceId.toString(),
      parentId: folder.parentId ? folder.parentId.toString() : null,
      name: folder.name,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }

  private toFileResponse(file: TemplateImageFileDocument): TemplateImageFileResponse {
    const settings = this.getSettings();
    const normalizedPath = file.publicPath.replace(/\/+$/g, '').replace(/\/+/g, '/');
    const normalizedBaseUrl = settings.publicBaseUrl.replace(/\/+$/g, '');
    const publicUrl = normalizedBaseUrl
      ? `${normalizedBaseUrl}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`
      : normalizedPath;

    return {
      id: file.id,
      workspaceId: file.workspaceId.toString(),
      folderId: file.folderId ? file.folderId.toString() : null,
      originalName: file.originalName,
      storedName: file.storedName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      relativePath: file.relativePath,
      publicPath: normalizedPath,
      publicUrl,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  private async resolveOwnedFolder(
    folderId: string | undefined,
    workspaceId: string,
    options: { allowRoot: boolean; notFoundCode: string },
  ): Promise<TemplateImageFolderDocument | null> {
    const normalized = folderId?.trim();

    if (!normalized) {
      if (options.allowRoot) {
        return null;
      }

      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TEMPLATE_IMAGE_FOLDER_REQUIRED',
        'Folder id is required',
      );
    }

    if (!Types.ObjectId.isValid(normalized)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_TEMPLATE_IMAGE_FOLDER_ID',
        'Invalid folder id',
      );
    }

    const folder = await this.templateImageFolderModel
      .findOne({
        _id: this.toObjectId(normalized),
        workspaceId: this.toObjectId(workspaceId),
      })
      .exec();

    if (!folder) {
      throw new AppException(HttpStatus.NOT_FOUND, options.notFoundCode, 'Folder not found');
    }

    return folder;
  }

  private async resolveWorkspaceId(authUser: AuthUser): Promise<string> {
    if (!authUser.workspaceId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WORKSPACE_CONTEXT_REQUIRED',
        'workspaceId is required in the authenticated context',
      );
    }

    if (!Types.ObjectId.isValid(authUser.workspaceId)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_WORKSPACE_ID', 'Invalid workspaceId');
    }

    const workspace = await this.workspacesService.findById(authUser.workspaceId);
    if (!workspace) {
      throw new AppException(HttpStatus.NOT_FOUND, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }

    return authUser.workspaceId;
  }

  private getSettings(): TemplateImageSettings {
    const media = this.configService.get<{
      templateImages?: {
        uploadDir?: string;
        publicPath?: string;
        publicBaseUrl?: string;
        quotaMb?: number;
        maxFileSizeMb?: number;
      };
    }>('media');

    const configuredUploadDir =
      media?.templateImages?.uploadDir?.trim() || 'uploads/template-images';
    const uploadDir = isAbsolute(configuredUploadDir)
      ? configuredUploadDir
      : join(process.cwd(), configuredUploadDir);

    return {
      uploadDir,
      publicPath: media?.templateImages?.publicPath?.trim() || '/uploads/template-images',
      publicBaseUrl: media?.templateImages?.publicBaseUrl?.trim() || '',
      quotaBytes: Math.max(1, Math.floor((media?.templateImages?.quotaMb ?? 250) * 1024 * 1024)),
      maxFileBytes: Math.max(
        1,
        Math.floor((media?.templateImages?.maxFileSizeMb ?? 10) * 1024 * 1024),
      ),
    };
  }

  private sanitizeBaseName(name: string): string {
    const raw = name.replace(extname(name), '').trim().toLowerCase();
    const sanitized = raw
      .replace(/[^a-z0-9 _-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return sanitized.slice(0, 64) || 'image';
  }

  private resolveExtension(originalName: string, mimeType: string): string {
    const byMime = MIME_TO_EXTENSION[mimeType] ?? '';
    if (byMime) {
      return byMime;
    }

    const byName = extname(originalName).toLowerCase();
    if (byName && byName.length <= 10) {
      return byName;
    }

    return '.img';
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_ID', 'Invalid ObjectId');
    }

    return new Types.ObjectId(id);
  }
}
