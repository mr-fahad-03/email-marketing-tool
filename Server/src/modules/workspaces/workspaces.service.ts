import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { CreateDefaultWorkspaceDto } from './dto/create-default-workspace.dto';
import { WorkspaceRole } from './constants/workspace-role.enum';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<Workspace>,
  ) {}

  health(): { module: string; status: string; next: string } {
    return {
      module: 'workspaces',
      status: 'ready',
      next: 'Workspace persistence layer is active.',
    };
  }

  async createDefaultWorkspaceForUser(dto: CreateDefaultWorkspaceDto): Promise<WorkspaceDocument> {
    const ownerUserObjectId = this.toObjectId(dto.ownerUserId, 'INVALID_OWNER_ID');

    return this.workspaceModel.create({
      name: this.resolveDefaultWorkspaceName(dto.ownerFullName, dto.name),
      createdBy: ownerUserObjectId,
      members: [
        {
          userId: ownerUserObjectId,
          role: WorkspaceRole.OWNER,
        },
      ],
    });
  }

  async findById(workspaceId: string): Promise<WorkspaceDocument | null> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      return null;
    }

    return this.workspaceModel.findById(workspaceId).exec();
  }

  async ensureCategories(workspaceId: string, categories: string[]): Promise<void> {
    const normalized = Array.from(
      new Set(
        categories
          .map((category) => category.trim().toLowerCase())
          .filter((category) => category.length > 0),
      ),
    );

    if (normalized.length === 0) {
      return;
    }

    await this.workspaceModel
      .updateOne(
        { _id: this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID') },
        {
          $addToSet: {
            categories: { $each: normalized },
          },
        },
      )
      .exec();
  }

  async listCategories(workspaceId: string): Promise<string[]> {
    const workspace = await this.findById(workspaceId);
    if (!workspace) {
      return [];
    }

    return Array.from(
      new Set((workspace.categories ?? []).map((category) => category.trim().toLowerCase()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
  }

  async removeCategory(workspaceId: string, category: string): Promise<void> {
    const normalizedCategory = category.trim().toLowerCase();
    if (!normalizedCategory) {
      return;
    }

    await this.workspaceModel
      .updateOne(
        { _id: this.toObjectId(workspaceId, 'INVALID_WORKSPACE_ID') },
        {
          $pull: {
            categories: normalizedCategory,
          },
        },
      )
      .exec();
  }

  private resolveDefaultWorkspaceName(fullName: string, customName?: string): string {
    const name = customName?.trim();
    if (name) {
      return name;
    }

    const firstName = fullName.trim().split(/\s+/)[0] ?? 'My';
    return `${firstName}'s Workspace`;
  }

  private toObjectId(id: string, code: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppException(HttpStatus.BAD_REQUEST, code, 'Invalid ObjectId provided');
    }

    return new Types.ObjectId(id);
  }
}
