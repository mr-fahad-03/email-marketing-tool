import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthUser } from '../../common/types/auth-user.type';
import { Contact } from '../contacts/schemas/contact.schema';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ListProviderTemplatesDto } from './dto/list-provider-templates.dto';
import {
  TemplateChannelType,
  TemplateEditorType,
  TemplateStatus,
  TemplateVisibility,
} from './constants/template.enums';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { Template, TemplateDocument } from './schemas/template.schema';
import { TemplatesPreviewService } from './templates-preview.service';
import { TemplatesVariableService } from './templates-variable.service';
import {
  MjmlProviderStatusResponse,
  MjmlProviderTemplateError,
  MjmlRenderResponse,
  ProviderTemplateDetailResponse,
  ProviderTemplateListItem,
  ProviderTemplateListResponse,
  TemplateListResponse,
  TemplatePreviewResponse,
  TemplateResponse,
} from './types/template.response';

interface GithubTreeEntry {
  path?: string;
  type?: string;
}

interface GithubTreeResponse {
  tree?: GithubTreeEntry[];
}

interface MjmlApiResponse {
  html?: string;
  mjml?: string;
  errors?: unknown[];
}

interface MjmlProviderSettings {
  enabled: boolean;
  apiBaseUrl: string;
  appId: string;
  secretKey: string;
  renderMode: 'hybrid' | 'api_only' | 'local_only';
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  githubToken: string;
}

interface MjmlTemplateCatalogEntry extends ProviderTemplateListItem {
  sourcePath: string;
}

@Injectable()
export class TemplatesService {
  private readonly templateListCacheTtlMs = 15 * 60 * 1000;
  private readonly templateDetailCacheTtlMs = 30 * 60 * 1000;

  private mjmlTemplateListCache: { expiresAt: number; items: MjmlTemplateCatalogEntry[] } | null = null;
  private readonly mjmlTemplateDetailCache = new Map<
    string,
    { expiresAt: number; detail: ProviderTemplateDetailResponse }
  >();
  private mjmlApiHealthCache: { expiresAt: number; reachable: boolean } | null = null;

  constructor(
    @InjectModel(Template.name)
    private readonly templateModel: Model<Template>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<Contact>,
    private readonly configService: ConfigService,
    private readonly workspacesService: WorkspacesService,
    private readonly variableService: TemplatesVariableService,
    private readonly previewService: TemplatesPreviewService,
  ) {}

  async create(dto: CreateTemplateDto, authUser: AuthUser): Promise<TemplateResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);

    const template = new this.templateModel({
      workspaceId: this.toObjectId(workspaceId),
      name: dto.name.trim(),
      channelType: dto.channelType,
      category: dto.category,
      status: dto.status ?? TemplateStatus.DRAFT,
      visibility: dto.visibility ?? TemplateVisibility.PERSONAL,
      editorType: dto.editorType ?? TemplateEditorType.HTML,
      layoutPreset: dto.layoutPreset,
      variables: this.buildVariables(dto, undefined),
      email: null,
      whatsapp: null,
    });

    if (dto.channelType === TemplateChannelType.EMAIL) {
      this.assertEmailCreatePayload(dto);
      template.email = {
        subject: dto.subject as string,
        previewText: dto.previewText ?? '',
        htmlBody: dto.htmlBody as string,
        textBody: dto.textBody ?? '',
        designJson: dto.designJson ?? null,
        mjmlBody: dto.mjmlBody ?? null,
      };
    } else {
      this.assertWhatsAppCreatePayload(dto);
      template.whatsapp = {
        templateName: dto.templateName as string,
        language: dto.language as string,
        bodyParams: dto.bodyParams ?? [],
        headerParams: dto.headerParams ?? [],
        buttonParams: dto.buttonParams ?? [],
      };
    }

    const saved = await this.saveWithDuplicateHandling(template);
    return this.toResponse(saved);
  }

  async findAll(query: ListTemplatesDto, authUser: AuthUser): Promise<TemplateListResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const filter: Record<string, unknown> = {
      workspaceId: this.toObjectId(workspaceId),
    };

    if (query.channelType) {
      filter.channelType = query.channelType;
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.visibility) {
      filter.visibility = query.visibility;
    }

    if (query.editorType) {
      filter.editorType = query.editorType;
    }

    if (query.search?.trim()) {
      filter.name = new RegExp(this.escapeRegex(query.search.trim()), 'i');
    }

    const [templates, total] = await Promise.all([
      this.templateModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.templateModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items: templates.map((template) => this.toResponse(template)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  getMjmlProviderStatus(): MjmlProviderStatusResponse {
    const settings = this.getMjmlSettings();
    const apiReachable =
      this.mjmlApiHealthCache && this.mjmlApiHealthCache.expiresAt > Date.now()
        ? this.mjmlApiHealthCache.reachable
        : null;

    if (!settings.enabled) {
      return {
        provider: 'mjml',
        enabled: false,
        configured: false,
        renderMode: settings.renderMode,
        apiReachable,
        fallbackToLocal: false,
        message: 'Provider is disabled. Set MJML_PROVIDER_ENABLED=true to enable it.',
      };
    }

    const apiConfigured = Boolean(settings.appId && settings.secretKey);
    if (settings.renderMode === 'api_only' && !apiConfigured) {
      return {
        provider: 'mjml',
        enabled: true,
        configured: false,
        renderMode: settings.renderMode,
        apiReachable,
        fallbackToLocal: false,
        message: 'MJML API-only mode is enabled but MJML_API_APP_ID / MJML_API_SECRET_KEY are missing.',
      };
    }

    if (!apiConfigured && settings.renderMode === 'hybrid') {
      return {
        provider: 'mjml',
        enabled: true,
        configured: true,
        renderMode: settings.renderMode,
        apiReachable,
        fallbackToLocal: true,
        message: 'Provider is enabled. Running in local renderer mode because MJML API credentials are not set.',
      };
    }

    return {
      provider: 'mjml',
      enabled: true,
      configured: true,
      renderMode: settings.renderMode,
      apiReachable,
      fallbackToLocal: settings.renderMode !== 'api_only',
      message:
        settings.renderMode === 'local_only'
          ? 'Provider is enabled and using local MJML compiler.'
          : 'Provider is enabled and ready (API-first rendering).',
    };
  }

  async listMjmlTemplates(
    query: ListProviderTemplatesDto,
    authUser: AuthUser,
  ): Promise<ProviderTemplateListResponse> {
    await this.resolveWorkspaceId(authUser);

    const status = this.getMjmlProviderStatus();
    if (!status.enabled) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'MJML_PROVIDER_DISABLED', status.message);
    }

    const page = query.page ?? 0;
    const limit = query.limit ?? 24;

    const items = await this.getCachedMjmlTemplateList();
    const filtered = items.filter((item) => this.matchesMjmlTemplateFilter(item, query));
    const start = page * limit;

    return {
      provider: 'mjml',
      total: filtered.length,
      items: filtered.slice(start, start + limit),
    };
  }

  async getMjmlTemplateById(
    templateId: string,
    authUser: AuthUser,
  ): Promise<ProviderTemplateDetailResponse> {
    await this.resolveWorkspaceId(authUser);

    const status = this.getMjmlProviderStatus();
    if (!status.enabled) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'MJML_PROVIDER_DISABLED', status.message);
    }

    const now = Date.now();
    const cached = this.mjmlTemplateDetailCache.get(templateId);
    if (cached && cached.expiresAt > now) {
      return cached.detail;
    }

    const catalog = await this.getCachedMjmlTemplateList();
    const match = catalog.find((item) => item.templateId === templateId);
    if (!match) {
      throw new AppException(HttpStatus.NOT_FOUND, 'MJML_TEMPLATE_NOT_FOUND', 'Template not found in provider library');
    }

    const mjml = await this.fetchRawTemplate(match.sourcePath);
    const rendered = await this.compileMjml(mjml);

    const detail: ProviderTemplateDetailResponse = {
      provider: 'mjml',
      templateId: match.templateId,
      name: match.name,
      thumbnail: match.thumbnail,
      categoryHints: match.categoryHints,
      mjml: rendered.mjml,
      html: rendered.html,
      engine: rendered.engine,
      errors: rendered.errors,
    };

    this.mjmlTemplateDetailCache.set(templateId, {
      expiresAt: now + this.templateDetailCacheTtlMs,
      detail,
    });

    return detail;
  }

  async renderMjml(mjml: string): Promise<MjmlRenderResponse> {
    const status = this.getMjmlProviderStatus();
    if (!status.enabled) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'MJML_PROVIDER_DISABLED', status.message);
    }

    return this.compileMjml(mjml);
  }

  async findOne(id: string, authUser: AuthUser): Promise<TemplateResponse> {
    const template = await this.findOwnedTemplate(id, authUser);
    return this.toResponse(template);
  }

  async update(id: string, dto: UpdateTemplateDto, authUser: AuthUser): Promise<TemplateResponse> {
    const template = await this.findOwnedTemplate(id, authUser);

    if (dto.name !== undefined) {
      template.name = dto.name.trim();
    }

    if (dto.category !== undefined) {
      template.category = dto.category;
    }

    if (dto.status !== undefined) {
      template.status = dto.status;
    }

    if (dto.visibility !== undefined) {
      template.visibility = dto.visibility;
    }

    if (dto.editorType !== undefined) {
      template.editorType = dto.editorType;
    }

    if (dto.layoutPreset !== undefined) {
      template.layoutPreset = dto.layoutPreset;
    }

    if (template.channelType === TemplateChannelType.EMAIL) {
      this.assertNoWhatsAppFieldsInEmailUpdate(dto);

      if (!template.email) {
        throw new AppException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'EMAIL_TEMPLATE_CONTENT_MISSING',
          'Email template content is missing',
        );
      }

      if (dto.subject !== undefined) {
        template.email.subject = dto.subject;
      }
      if (dto.previewText !== undefined) {
        template.email.previewText = dto.previewText;
      }
      if (dto.htmlBody !== undefined) {
        template.email.htmlBody = dto.htmlBody;
      }
      if (dto.textBody !== undefined) {
        template.email.textBody = dto.textBody;
      }
      if (dto.designJson !== undefined) {
        template.email.designJson = dto.designJson;
      }
      if (dto.mjmlBody !== undefined) {
        template.email.mjmlBody = dto.mjmlBody;
      }
    }

    if (template.channelType === TemplateChannelType.WHATSAPP) {
      this.assertNoEmailFieldsInWhatsAppUpdate(dto);

      if (!template.whatsapp) {
        throw new AppException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'WHATSAPP_TEMPLATE_CONTENT_MISSING',
          'WhatsApp template content is missing',
        );
      }

      if (dto.templateName !== undefined) {
        template.whatsapp.templateName = dto.templateName;
      }
      if (dto.language !== undefined) {
        template.whatsapp.language = dto.language;
      }
      if (dto.bodyParams !== undefined) {
        template.whatsapp.bodyParams = dto.bodyParams;
      }
      if (dto.headerParams !== undefined) {
        template.whatsapp.headerParams = dto.headerParams;
      }
      if (dto.buttonParams !== undefined) {
        template.whatsapp.buttonParams = dto.buttonParams;
      }
    }

    template.variables = this.buildVariables(dto, template);

    const saved = await this.saveWithDuplicateHandling(template);
    return this.toResponse(saved);
  }

  async remove(id: string, authUser: AuthUser): Promise<{ deleted: true; id: string }> {
    const template = await this.findOwnedTemplate(id, authUser);
    await this.templateModel.deleteOne({ _id: template._id }).exec();

    return {
      deleted: true,
      id,
    };
  }

  async preview(
    id: string,
    dto: PreviewTemplateDto,
    authUser: AuthUser,
  ): Promise<TemplatePreviewResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const template = await this.findOwnedTemplate(id, authUser);

    const sampleData = await this.resolveSampleData(workspaceId, dto);

    return this.previewService.renderTemplate(template, sampleData);
  }

  private async resolveSampleData(
    workspaceId: string,
    dto: PreviewTemplateDto,
  ): Promise<Record<string, unknown>> {
    const defaultSample: Record<string, unknown> = {
      firstName: 'Alex',
      lastName: 'Johnson',
      fullName: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '+15550001111',
      company: 'Acme Inc',
      category: 'vip',
      labels: ['beta'],
      customFields: {
        city: 'Lahore',
        plan: 'pro',
      },
    };

    let contactSample: Record<string, unknown> = {};

    if (dto.contactId) {
      const contact = await this.contactModel
        .findOne({
          _id: this.toObjectId(dto.contactId),
          workspaceId: this.toObjectId(workspaceId),
        })
        .lean()
        .exec();

      if (!contact) {
        throw new AppException(HttpStatus.NOT_FOUND, 'CONTACT_NOT_FOUND', 'Contact not found');
      }

      contactSample = {
        firstName: contact.firstName,
        lastName: contact.lastName,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        category: contact.category,
        labels: contact.labels,
        customFields: contact.customFields,
      };
    }

    const requestSample = dto.sampleContact
      ? {
          firstName: dto.sampleContact.firstName,
          lastName: dto.sampleContact.lastName,
          fullName: dto.sampleContact.fullName,
          email: dto.sampleContact.email,
          phone: dto.sampleContact.phone,
          company: dto.sampleContact.company,
          customFields: dto.sampleContact.customFields,
        }
      : {};

    const merged = {
      ...defaultSample,
      ...contactSample,
      ...requestSample,
    } as Record<string, unknown>;

    if (!merged.fullName) {
      const firstName = typeof merged.firstName === 'string' ? merged.firstName.trim() : '';
      const lastName = typeof merged.lastName === 'string' ? merged.lastName.trim() : '';
      merged.fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    }

    return merged;
  }

  private buildVariables(
    dto: Pick<
      CreateTemplateDto | UpdateTemplateDto,
      | 'variables'
      | 'subject'
      | 'previewText'
      | 'htmlBody'
      | 'textBody'
      | 'mjmlBody'
      | 'templateName'
      | 'language'
      | 'bodyParams'
      | 'headerParams'
      | 'buttonParams'
    >,
    existingTemplate: TemplateDocument | undefined,
  ): string[] {
    let extracted: string[] = [];

    if (existingTemplate?.channelType === TemplateChannelType.EMAIL || dto.subject !== undefined) {
      const subject = dto.subject ?? existingTemplate?.email?.subject;
      const previewText = dto.previewText ?? existingTemplate?.email?.previewText;
      const htmlBody = dto.htmlBody ?? existingTemplate?.email?.htmlBody;
      const textBody = dto.textBody ?? existingTemplate?.email?.textBody;
      const mjmlBody = dto.mjmlBody ?? existingTemplate?.email?.mjmlBody;

      extracted = this.variableService.extractVariablesFromTexts([
        subject,
        previewText,
        htmlBody,
        textBody,
        mjmlBody,
      ]);
    }

    if (
      existingTemplate?.channelType === TemplateChannelType.WHATSAPP ||
      dto.templateName !== undefined ||
      dto.bodyParams !== undefined ||
      dto.headerParams !== undefined ||
      dto.buttonParams !== undefined
    ) {
      const templateName = dto.templateName ?? existingTemplate?.whatsapp?.templateName;
      const language = dto.language ?? existingTemplate?.whatsapp?.language;
      const bodyParams = dto.bodyParams ?? existingTemplate?.whatsapp?.bodyParams ?? [];
      const headerParams = dto.headerParams ?? existingTemplate?.whatsapp?.headerParams ?? [];
      const buttonParams = dto.buttonParams ?? existingTemplate?.whatsapp?.buttonParams ?? [];

      extracted = this.variableService.extractVariablesFromTexts([
        templateName,
        language,
        ...bodyParams,
        ...headerParams,
        ...buttonParams,
      ]);
    }

    const explicitVariables = dto.variables ?? existingTemplate?.variables ?? [];
    return this.variableService.mergeVariables(explicitVariables, extracted);
  }

  private assertEmailCreatePayload(dto: CreateTemplateDto): void {
    const missingFields: string[] = [];

    if (!dto.subject) {
      missingFields.push('subject');
    }

    if (!dto.htmlBody) {
      missingFields.push('htmlBody');
    }

    if (missingFields.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'EMAIL_TEMPLATE_FIELDS_REQUIRED',
        `Missing required email template fields: ${missingFields.join(', ')}`,
      );
    }
  }

  private assertWhatsAppCreatePayload(dto: CreateTemplateDto): void {
    const missingFields: string[] = [];

    if (!dto.templateName) {
      missingFields.push('templateName');
    }

    if (!dto.language) {
      missingFields.push('language');
    }

    if (missingFields.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_TEMPLATE_FIELDS_REQUIRED',
        `Missing required WhatsApp template fields: ${missingFields.join(', ')}`,
      );
    }
  }

  private assertNoWhatsAppFieldsInEmailUpdate(dto: UpdateTemplateDto): void {
    const invalidFields: Array<keyof UpdateTemplateDto> = [
      'templateName',
      'language',
      'bodyParams',
      'headerParams',
      'buttonParams',
    ];

    const provided = invalidFields.filter((field) => dto[field] !== undefined);

    if (provided.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_WHATSAPP_FIELDS_FOR_EMAIL_TEMPLATE',
        `Cannot update WhatsApp fields on email template: ${provided.join(', ')}`,
      );
    }
  }

  private assertNoEmailFieldsInWhatsAppUpdate(dto: UpdateTemplateDto): void {
    const invalidFields: Array<keyof UpdateTemplateDto> = [
      'subject',
      'previewText',
      'htmlBody',
      'textBody',
      'designJson',
      'mjmlBody',
    ];

    const provided = invalidFields.filter((field) => dto[field] !== undefined);

    if (provided.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_EMAIL_FIELDS_FOR_WHATSAPP_TEMPLATE',
        `Cannot update email fields on WhatsApp template: ${provided.join(', ')}`,
      );
    }
  }

  private async findOwnedTemplate(id: string, authUser: AuthUser): Promise<TemplateDocument> {
    const workspaceId = await this.resolveWorkspaceId(authUser);

    const template = await this.templateModel
      .findOne({
        _id: this.toObjectId(id),
        workspaceId: this.toObjectId(workspaceId),
      })
      .exec();

    if (!template) {
      throw new AppException(HttpStatus.NOT_FOUND, 'TEMPLATE_NOT_FOUND', 'Template not found');
    }

    return template;
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

  private toResponse(template: TemplateDocument): TemplateResponse {
    const base = {
      id: template.id,
      workspaceId: template.workspaceId.toString(),
      channelType: template.channelType,
      name: template.name,
      category: template.category,
      status: template.status,
      visibility: template.visibility ?? TemplateVisibility.PERSONAL,
      editorType: template.editorType ?? TemplateEditorType.HTML,
      layoutPreset: template.layoutPreset ?? null,
      variables: [...template.variables],
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };

    if (template.channelType === TemplateChannelType.EMAIL && template.email) {
      return {
        ...base,
        channelType: TemplateChannelType.EMAIL,
        subject: template.email.subject,
        previewText: template.email.previewText,
        htmlBody: template.email.htmlBody,
        textBody: template.email.textBody,
        designJson: template.email.designJson ?? null,
        mjmlBody: template.email.mjmlBody ?? null,
      };
    }

    if (template.channelType === TemplateChannelType.WHATSAPP && template.whatsapp) {
      return {
        ...base,
        channelType: TemplateChannelType.WHATSAPP,
        templateName: template.whatsapp.templateName,
        language: template.whatsapp.language,
        bodyParams: [...template.whatsapp.bodyParams],
        headerParams: [...template.whatsapp.headerParams],
        buttonParams: [...template.whatsapp.buttonParams],
      };
    }

    throw new AppException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INVALID_TEMPLATE_STATE',
      'Template content does not match channel type',
    );
  }

  private async saveWithDuplicateHandling(template: TemplateDocument): Promise<TemplateDocument> {
    try {
      return await template.save();
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'TEMPLATE_ALREADY_EXISTS',
          'A template with this name already exists for this workspace and channel',
        );
      }

      throw error;
    }
  }

  private async getCachedMjmlTemplateList(): Promise<MjmlTemplateCatalogEntry[]> {
    const now = Date.now();
    if (this.mjmlTemplateListCache && this.mjmlTemplateListCache.expiresAt > now) {
      return this.mjmlTemplateListCache.items;
    }

    const settings = this.getMjmlSettings();
    const tree = await this.fetchRepoTree(settings);
    const thumbnailPaths = new Set(
      tree
        .filter((entry) => entry.type === 'blob' && entry.path?.startsWith('thumbnails/'))
        .map((entry) => entry.path as string),
    );

    const templates = tree
      .filter(
        (entry) =>
          entry.type === 'blob' &&
          entry.path?.startsWith('templates/') &&
          entry.path?.endsWith('.mjml'),
      )
      .map((entry) => this.mapGithubTemplateEntry(entry.path as string, thumbnailPaths, settings))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.mjmlTemplateListCache = {
      expiresAt: now + this.templateListCacheTtlMs,
      items: templates,
    };

    return templates;
  }

  private async fetchRepoTree(settings: MjmlProviderSettings): Promise<GithubTreeEntry[]> {
    const response = await fetch(
      `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/git/trees/${encodeURIComponent(settings.repoBranch)}?recursive=1`,
      {
        method: 'GET',
        headers: this.githubHeaders(settings),
      },
    );

    if (!response.ok) {
      const hint =
        response.status === 403 ? ' Consider setting GITHUB_TOKEN for higher rate limits.' : '';
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        'MJML_PROVIDER_REQUEST_FAILED',
        `Failed to fetch MJML template index from GitHub (${response.status}).${hint}`,
      );
    }

    const payload = (await response.json()) as GithubTreeResponse;
    return Array.isArray(payload.tree) ? payload.tree : [];
  }

  private mapGithubTemplateEntry(
    sourcePath: string,
    thumbnailPaths: Set<string>,
    settings: MjmlProviderSettings,
  ): MjmlTemplateCatalogEntry {
    const fileName = sourcePath.split('/').pop() ?? sourcePath;
    const baseName = fileName.replace(/\.mjml$/i, '');

    return {
      provider: 'mjml',
      templateId: this.encodeTemplateId(sourcePath),
      sourcePath,
      name: this.toTemplateName(baseName),
      thumbnail: this.resolveThumbnailUrl(sourcePath, baseName, thumbnailPaths, settings),
      categoryHints: this.inferCategoryHints(`${sourcePath} ${baseName}`),
    };
  }

  private resolveThumbnailUrl(
    sourcePath: string,
    baseName: string,
    thumbnailPaths: Set<string>,
    settings: MjmlProviderSettings,
  ): string {
    const baseCandidates = [
      `thumbnails/${baseName}.png`,
      `thumbnails/${baseName}.jpg`,
      `thumbnails/${baseName}.jpeg`,
      `thumbnails/${baseName}.webp`,
    ];

    const nestedName = sourcePath.replace(/^templates\//, '').replace(/\.mjml$/i, '');
    const nestedCandidates = [
      `thumbnails/${nestedName}.png`,
      `thumbnails/${nestedName}.jpg`,
      `thumbnails/${nestedName}.jpeg`,
      `thumbnails/${nestedName}.webp`,
    ];

    const match = [...baseCandidates, ...nestedCandidates].find((candidate) =>
      thumbnailPaths.has(candidate),
    );

    return match ? this.toRawGithubUrl(match, settings) : '';
  }

  private async fetchRawTemplate(sourcePath: string): Promise<string> {
    const settings = this.getMjmlSettings();
    const response = await fetch(this.toRawGithubUrl(sourcePath, settings), {
      method: 'GET',
      headers: this.githubHeaders(settings),
    });

    if (!response.ok) {
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        'MJML_PROVIDER_REQUEST_FAILED',
        `Failed to fetch MJML template source (${response.status})`,
      );
    }

    return response.text();
  }

  private async compileMjml(mjml: string): Promise<MjmlRenderResponse> {
    const settings = this.getMjmlSettings();

    if (settings.renderMode === 'local_only') {
      return this.compileMjmlLocally(mjml);
    }

    if (settings.renderMode === 'api_only') {
      return this.compileMjmlViaApi(mjml);
    }

    if (!settings.appId || !settings.secretKey) {
      return this.compileMjmlLocally(mjml);
    }

    try {
      return await this.compileMjmlViaApi(mjml);
    } catch {
      return this.compileMjmlLocally(mjml);
    }
  }

  private async compileMjmlViaApi(mjml: string): Promise<MjmlRenderResponse> {
    const settings = this.getMjmlSettings();
    if (!settings.appId || !settings.secretKey) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'MJML_API_NOT_CONFIGURED',
        'MJML_API_APP_ID and MJML_API_SECRET_KEY are required for API rendering',
      );
    }

    const response = await fetch(`${settings.apiBaseUrl.replace(/\/+$/, '')}/render`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${settings.appId}:${settings.secretKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ mjml }),
    });

    if (!response.ok) {
      this.mjmlApiHealthCache = { expiresAt: Date.now() + 5 * 60 * 1000, reachable: false };
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        'MJML_API_RENDER_FAILED',
        `MJML API render failed (${response.status})`,
      );
    }

    const payload = (await response.json()) as MjmlApiResponse;
    this.mjmlApiHealthCache = { expiresAt: Date.now() + 5 * 60 * 1000, reachable: true };

    return {
      engine: 'api',
      mjml: typeof payload.mjml === 'string' ? payload.mjml : mjml,
      html: typeof payload.html === 'string' ? payload.html : '',
      errors: this.normalizeMjmlErrors(payload.errors),
    };
  }

  private compileMjmlLocally(mjml: string): MjmlRenderResponse {
    type MjmlCompilerResult = {
      html?: string;
      errors?: unknown[];
    };

    type MjmlCompiler = (
      input: string,
      options?: Record<string, unknown>,
    ) => MjmlCompilerResult;

    let compiler: MjmlCompiler | null = null;

    try {
      const required = require('mjml') as MjmlCompiler | { default?: MjmlCompiler };
      compiler = typeof required === 'function' ? required : required.default ?? null;
    } catch {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'MJML_LOCAL_RENDERER_MISSING',
        'Local MJML compiler is not installed. Run npm install mjml in Server to enable fallback rendering.',
      );
    }

    if (!compiler) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'MJML_LOCAL_RENDERER_MISSING',
        'Local MJML compiler is not available.',
      );
    }

    const output = compiler(mjml, {
      validationLevel: 'soft',
      minify: false,
      keepComments: false,
    });

    return {
      engine: 'local',
      mjml,
      html: typeof output.html === 'string' ? output.html : '',
      errors: this.normalizeMjmlErrors(output.errors),
    };
  }

  private normalizeMjmlErrors(errors: unknown): MjmlProviderTemplateError[] {
    if (!Array.isArray(errors)) {
      return [];
    }

    const normalized: MjmlProviderTemplateError[] = [];

    for (const entry of errors) {
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }

      const record = entry as Record<string, unknown>;
      const message = this.toStringValue(record.message) || this.toStringValue(record.formattedMessage);
      if (!message) {
        continue;
      }

      const item: MjmlProviderTemplateError = { message };
      const tagName = this.toStringValue(record.tagName);
      const formattedMessage = this.toStringValue(record.formattedMessage);
      const line = this.toNumber(record.line);

      if (tagName) {
        item.tagName = tagName;
      }
      if (formattedMessage) {
        item.formattedMessage = formattedMessage;
      }
      if (line > 0) {
        item.line = line;
      }

      normalized.push(item);
    }

    return normalized;
  }

  private matchesMjmlTemplateFilter(
    item: ProviderTemplateListItem,
    query: Pick<ListProviderTemplatesDto, 'search' | 'category'>,
  ): boolean {
    const search = query.search?.trim().toLowerCase();
    if (search) {
      const haystack = `${item.name} ${item.categoryHints.join(' ')}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    const category = query.category?.trim().toLowerCase();
    if (!category || category === 'all') {
      return true;
    }

    return item.categoryHints.includes(category);
  }

  private inferCategoryHints(source: string): string[] {
    const haystack = source.toLowerCase();
    const keywordMap: Record<string, string[]> = {
      business: ['business', 'corporate', 'agency', 'consulting', 'finance'],
      'online-store': ['ecommerce', 'e-commerce', 'store', 'shop', 'retail', 'marketplace'],
      kitchen: ['food', 'restaurant', 'kitchen', 'cafe', 'bakery', 'catering'],
      medicine: ['health', 'healthcare', 'medical', 'medicine', 'clinic', 'doctor', 'hospital'],
      education: ['education', 'school', 'course', 'academy', 'learning', 'university'],
      holidays: [
        'holiday',
        'christmas',
        'new year',
        'halloween',
        'easter',
        'valentine',
        'black friday',
        'memorial day',
        'fathers day',
      ],
      tourism: ['travel', 'tourism', 'hotel', 'trip', 'vacation', 'flight', 'destination'],
    };

    const matches = Object.entries(keywordMap)
      .filter(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword)))
      .map(([category]) => category);

    return matches.length > 0 ? matches : ['general'];
  }

  private toTemplateName(value: string): string {
    return value
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private encodeTemplateId(sourcePath: string): string {
    return Buffer.from(sourcePath, 'utf8').toString('base64url');
  }

  private toRawGithubUrl(sourcePath: string, settings: MjmlProviderSettings): string {
    return `https://raw.githubusercontent.com/${settings.repoOwner}/${settings.repoName}/${settings.repoBranch}/${sourcePath}`;
  }

  private githubHeaders(settings: MjmlProviderSettings): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketing-platform-mjml-provider',
    };

    if (settings.githubToken) {
      headers.Authorization = `Bearer ${settings.githubToken}`;
    }

    return headers;
  }

  private getMjmlSettings(): MjmlProviderSettings {
    const config = this.configService.get<{
      mjml?: {
        enabled?: boolean;
        apiBaseUrl?: string;
        appId?: string;
        secretKey?: string;
        renderMode?: string;
        repoOwner?: string;
        repoName?: string;
        repoBranch?: string;
        githubToken?: string;
      };
    }>('templateProviders');

    const mjml = config?.mjml ?? {};

    return {
      enabled: Boolean(mjml.enabled),
      apiBaseUrl: mjml.apiBaseUrl?.trim() || 'https://api.mjml.io/v1',
      appId: mjml.appId?.trim() ?? '',
      secretKey: mjml.secretKey?.trim() ?? '',
      renderMode: this.toRenderMode(mjml.renderMode),
      repoOwner: mjml.repoOwner?.trim() || 'mjmlio',
      repoName: mjml.repoName?.trim() || 'email-templates',
      repoBranch: mjml.repoBranch?.trim() || 'master',
      githubToken: mjml.githubToken?.trim() ?? '',
    };
  }

  private toRenderMode(value: string | undefined): 'hybrid' | 'api_only' | 'local_only' {
    if (value === 'api_only' || value === 'local_only') {
      return value;
    }

    return 'hybrid';
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  }

  private toStringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
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
