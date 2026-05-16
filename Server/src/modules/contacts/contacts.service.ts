import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthUser } from '../../common/types/auth-user.type';
import { WorkspacesService } from '../workspaces/workspaces.service';
import {
  ContactEmailStatus,
  ContactSource,
  ContactSubscriptionStatus,
  ContactWhatsappStatus,
} from './constants/contact.enums';
import { BulkDeleteContactsDto } from './dto/bulk-delete-contacts.dto';
import { BulkCategoryUpdateDto } from './dto/bulk-category-update.dto';
import { BulkTagUpdateDto } from './dto/bulk-tag-update.dto';
import { CheckDuplicatesDto } from './dto/check-duplicates.dto';
import { CreateContactCategoryDto } from './dto/create-contact-category.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Contact, ContactDocument } from './schemas/contact.schema';
import { ContactsImportJobService } from './contacts-import-job.service';
import { ContactsImportService, ParsedContactCsvRow } from './contacts-import.service';
import {
  ContactCategorySummaryResponse,
  ContactImportResultResponse,
  ContactListResponse,
  ContactResponse,
} from './types/contact.response';

interface ContactWriteInput {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  company?: string;
  category?: string;
  labels?: string[];
  customFields?: Record<string, unknown>;
  emailStatus?: ContactEmailStatus;
  whatsappStatus?: ContactWhatsappStatus;
  subscriptionStatus?: ContactSubscriptionStatus;
  source?: ContactSource;
  notes?: string;
}

interface BuildContactPayloadOptions {}

@Injectable()
export class ContactsService {
  constructor(
    @InjectModel(Contact.name)
    private readonly contactModel: Model<Contact>,
    private readonly workspacesService: WorkspacesService,
    private readonly contactsImportService: ContactsImportService,
    private readonly contactsImportJobService: ContactsImportJobService,
  ) {}

  async checkDuplicates(dto: CheckDuplicatesDto, authUser: AuthUser): Promise<string[]> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const normalizedEmails = dto.emails
      .map((e) => (e || '').toLowerCase().trim())
      .filter(Boolean);

    if (normalizedEmails.length === 0) return [];

    const existing = await this.contactModel
      .find({
        workspaceId: this.toObjectId(workspaceId),
        emailNormalized: { $in: normalizedEmails },
      })
      .select('emailNormalized')
      .lean()
      .exec();

    return existing.map((c) => c.emailNormalized);
  }

  async create(dto: CreateContactDto, authUser: AuthUser): Promise<ContactResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const payload = this.buildContactPayload(dto);

    if (payload.category) {
      await this.workspacesService.ensureCategories(workspaceId, [payload.category]);
    }

    const created = await this.saveWithDuplicateHandling(
      new this.contactModel({
        workspaceId: this.toObjectId(workspaceId),
        ...payload,
      }),
    );

    return this.toResponse(created);
  }

  async createCategory(
    dto: CreateContactCategoryDto,
    authUser: AuthUser,
  ): Promise<{ category: string }> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const category = this.normalizeCategory(dto.category);

    if (!category) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'CATEGORY_REQUIRED', 'Category is required');
    }

    await this.workspacesService.ensureCategories(workspaceId, [category]);

    return { category };
  }

  async removeCategory(
    categoryInput: string,
    authUser: AuthUser,
  ): Promise<{ category: string; modified: number }> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const category = this.normalizeCategory(categoryInput);

    if (!category) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'CATEGORY_REQUIRED', 'Category is required');
    }

    const workspaceObjectId = this.toObjectId(workspaceId);

    const [clearCategoryResult, pullLabelsTagsResult] = await Promise.all([
      this.contactModel
        .updateMany(
          {
            workspaceId: workspaceObjectId,
            category,
          },
          {
            $set: {
              category: '',
            },
          },
        )
        .exec(),
      this.contactModel
        .updateMany(
          {
            workspaceId: workspaceObjectId,
            $or: [{ labels: category }, { tags: category }],
          },
          {
            $pull: {
              labels: category,
              tags: category,
            },
          },
        )
        .exec(),
    ]);

    await this.workspacesService.removeCategory(workspaceId, category);

    return {
      category,
      modified: (clearCategoryResult.modifiedCount ?? 0) + (pullLabelsTagsResult.modifiedCount ?? 0),
    };
  }

  async findAll(query: ListContactsDto, authUser: AuthUser): Promise<ContactListResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      workspaceId: this.toObjectId(workspaceId),
      email: { $ne: null, $exists: true, $not: /^\s*$/ },
    };
    const andConditions: Record<string, unknown>[] = [];
    const createStartsWithRegex = (value: string): RegExp =>
      new RegExp(`^${this.escapeRegex(value)}`, 'i');
    const addStringStartsWithFilter = (fieldPath: string, value: string | undefined): void => {
      const normalizedValue = this.cleanString(value);
      if (!normalizedValue) {
        return;
      }

      andConditions.push({
        [fieldPath]: createStartsWithRegex(normalizedValue),
      });
    };

    if (query.emailStatus) {
      filter.emailStatus = query.emailStatus;
    }
    if (query.whatsappStatus) {
      filter.whatsappStatus = query.whatsappStatus;
    }
    if (query.subscriptionStatus) {
      filter.subscriptionStatus = query.subscriptionStatus;
    }
    if (query.source) {
      filter.source = query.source;
    }
    if (query.category) {
      const normalizedCategory = this.cleanString(query.category).toLowerCase();
      andConditions.push({
        $or: [
          { category: normalizedCategory },
          {
            $and: [
              {
                $or: [{ category: '' }, { category: null }, { category: { $exists: false } }],
              },
              { 'labels.0': normalizedCategory },
            ],
          },
          {
            $and: [
              {
                $or: [{ category: '' }, { category: null }, { category: { $exists: false } }],
              },
              {
                $or: [
                  { labels: { $exists: false } },
                  { labels: { $size: 0 } },
                  { 'labels.0': '' },
                ],
              },
              { 'tags.0': normalizedCategory },
            ],
          },
        ],
      });
    }
    if (query.labels?.length) {
      filter.labels = { $in: query.labels.map((label) => this.normalizeLabel(label)) };
    }

    addStringStartsWithFilter('fullName', query.contactName);
    addStringStartsWithFilter('email', query.email);
    addStringStartsWithFilter('company', query.company);
    addStringStartsWithFilter('customFields.country', query.country);
    addStringStartsWithFilter('customFields.city', query.city);
    addStringStartsWithFilter('customFields.designation', query.designation);
    addStringStartsWithFilter('customFields.department', query.department);
    addStringStartsWithFilter('customFields.leadSource', query.leadSource);

    const telephoneFilter = this.cleanString(query.telephone);
    if (telephoneFilter) {
      const regex = createStartsWithRegex(telephoneFilter);
      andConditions.push({
        $or: [{ phone: regex }, { 'customFields.telephone': regex }],
      });
    }

    const mobileFilter = this.cleanString(query.mobile);
    if (mobileFilter) {
      const regex = createStartsWithRegex(mobileFilter);
      andConditions.push({
        $or: [{ phone: regex }, { 'customFields.mobile': regex }],
      });
    }

    const additionalNumberFilter = this.cleanString(query.additionalNumber);
    if (additionalNumberFilter) {
      const regex = createStartsWithRegex(additionalNumberFilter);
      andConditions.push({
        $or: [{ phone: regex }, { 'customFields.additionalNumber': regex }],
      });
    }

    if (query.search) {
      const escaped = this.escapeRegex(query.search.trim());
      const searchRegex = new RegExp(escaped, 'i');

      andConditions.push({
        $or: [
          { fullName: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { company: searchRegex },
          { 'customFields.country': searchRegex },
          { 'customFields.city': searchRegex },
          { 'customFields.designation': searchRegex },
          { 'customFields.department': searchRegex },
          { 'customFields.leadSource': searchRegex },
          { 'customFields.telephone': searchRegex },
          { 'customFields.mobile': searchRegex },
          { 'customFields.additionalNumber': searchRegex },
        ],
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const [items, total] = await Promise.all([
      this.contactModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.contactModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items: items.map((item) => this.toResponse(item)),
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

  async findOne(id: string, authUser: AuthUser): Promise<ContactResponse> {
    const contact = await this.findOwnedContact(id, authUser);
    return this.toResponse(contact);
  }

  async getCategorySummary(authUser: AuthUser): Promise<ContactCategorySummaryResponse> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const workspaceObjectId = this.toObjectId(workspaceId);

    const [total, categoryGroups] = await Promise.all([
      this.contactModel
        .countDocuments({
          workspaceId: workspaceObjectId,
        })
        .exec(),
      this.contactModel
        .aggregate<{ category: string; count: number }>([
          {
            $match: {
              workspaceId: workspaceObjectId,
            },
          },
          {
            $project: {
              effectiveCategory: {
                $let: {
                  vars: {
                    categoryValue: { $trim: { input: { $ifNull: ['$category', ''] } } },
                    labelValue: {
                      $trim: {
                        input: { $ifNull: [{ $arrayElemAt: ['$labels', 0] }, ''] },
                      },
                    },
                    tagValue: {
                      $trim: {
                        input: { $ifNull: [{ $arrayElemAt: ['$tags', 0] }, ''] },
                      },
                    },
                  },
                  in: {
                    $toLower: {
                      $cond: [
                        { $gt: [{ $strLenCP: '$$categoryValue' }, 0] },
                        '$$categoryValue',
                        {
                          $cond: [
                            { $gt: [{ $strLenCP: '$$labelValue' }, 0] },
                            '$$labelValue',
                            '$$tagValue',
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          {
            $match: {
              effectiveCategory: { $type: 'string', $ne: '' },
            },
          },
          {
            $group: {
              _id: '$effectiveCategory',
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              category: '$_id',
              count: 1,
            },
          },
          {
            $sort: {
              category: 1,
            },
          },
        ])
        .exec(),
    ]);

    const workspaceCategories = await this.workspacesService.listCategories(workspaceId);
    const countsByCategory = new Map(categoryGroups.map((item) => [item.category, item.count]));
    const allCategories = Array.from(
      new Set([...workspaceCategories, ...categoryGroups.map((item) => item.category)]),
    ).sort((a, b) => a.localeCompare(b));

    return {
      total,
      categories: allCategories.map((category) => ({
        category,
        count: countsByCategory.get(category) ?? 0,
      })),
    };
  }

  async update(id: string, dto: UpdateContactDto, authUser: AuthUser): Promise<ContactResponse> {
    const contact = await this.findOwnedContact(id, authUser);

    const merged = this.buildContactPayload({
      firstName: dto.firstName ?? contact.firstName,
      lastName: dto.lastName ?? contact.lastName,
      fullName: dto.fullName ?? contact.fullName,
      email: dto.email ?? contact.email,
      phone: dto.phone ?? contact.phone,
      company: dto.company ?? contact.company,
      category: dto.category ?? contact.category,
      labels: dto.labels ?? (contact.labels?.length ? contact.labels : contact.tags),
      customFields: dto.customFields ?? contact.customFields,
      emailStatus: dto.emailStatus ?? contact.emailStatus,
      whatsappStatus: dto.whatsappStatus ?? contact.whatsappStatus,
      subscriptionStatus: dto.subscriptionStatus ?? contact.subscriptionStatus,
      source: dto.source ?? contact.source,
      notes: dto.notes ?? contact.notes,
    });

    contact.firstName = merged.firstName;
    contact.lastName = merged.lastName;
    contact.fullName = merged.fullName as string;
    contact.email = merged.email as string;
    contact.phone = merged.phone;
    contact.emailNormalized = merged.emailNormalized as string;
    contact.phoneNormalized = merged.phoneNormalized;
    contact.company = merged.company;
    contact.category = merged.category;
    contact.labels = merged.labels;
    // Keep legacy tags synchronized while downstream modules migrate.
    contact.tags = merged.tags;
    contact.customFields = merged.customFields;
    contact.emailStatus = merged.emailStatus;
    contact.whatsappStatus = merged.whatsappStatus;
    contact.subscriptionStatus = merged.subscriptionStatus;
    contact.source = merged.source;
    contact.notes = merged.notes;

    const saved = await this.saveWithDuplicateHandling(contact);

    if (merged.category) {
      await this.workspacesService.ensureCategories(contact.workspaceId.toString(), [merged.category]);
    }

    return this.toResponse(saved);
  }

  async remove(id: string, authUser: AuthUser): Promise<{ deleted: true; id: string }> {
    const contact = await this.findOwnedContact(id, authUser);
    await this.contactModel.deleteOne({ _id: contact._id }).exec();

    return {
      deleted: true,
      id,
    };
  }

  async bulkDelete(
    dto: BulkDeleteContactsDto,
    authUser: AuthUser,
  ): Promise<{ requested: number; deleted: number }> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const ids = dto.ids.map((id) => this.toObjectId(id));

    const result = await this.contactModel
      .deleteMany({
        workspaceId: this.toObjectId(workspaceId),
        _id: { $in: ids },
      })
      .exec();

    return {
      requested: dto.ids.length,
      deleted: result.deletedCount ?? 0,
    };
  }

  async bulkCategoryUpdate(
    dto: BulkCategoryUpdateDto,
    authUser: AuthUser,
  ): Promise<{ requested: number; modified: number }> {
    const workspaceId = await this.resolveWorkspaceId(authUser);
    const category = this.normalizeCategory(dto.category);

    if (!category) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CATEGORY_REQUIRED',
        'Category is required',
      );
    }

    const result = await this.contactModel
      .updateMany(
        {
          workspaceId: this.toObjectId(workspaceId),
          _id: { $in: dto.ids.map((id) => this.toObjectId(id)) },
        },
        {
          $set: { category },
        },
      )
      .exec();

    await this.workspacesService.ensureCategories(workspaceId, [category]);

    return {
      requested: dto.ids.length,
      modified: result.modifiedCount,
    };
  }

  async bulkTagUpdate(
    dto: BulkTagUpdateDto,
    authUser: AuthUser,
  ): Promise<{ requested: number; modified: number }> {
    const workspaceId = await this.resolveWorkspaceId(authUser);

    const addLabels = this.normalizeLabels(dto.addLabels ?? dto.addTags ?? []);
    const removeLabels = this.normalizeLabels(dto.removeLabels ?? dto.removeTags ?? []);
    const setLabels = dto.setLabels
      ? this.normalizeLabels(dto.setLabels)
      : dto.setTags
        ? this.normalizeLabels(dto.setTags)
        : undefined;

    if (!setLabels && !addLabels.length && !removeLabels.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'BULK_LABEL_ACTION_REQUIRED',
        'At least one of setLabels, addLabels, or removeLabels is required',
      );
    }

    const filter = {
      workspaceId: this.toObjectId(workspaceId),
      _id: { $in: dto.ids.map((id) => this.toObjectId(id)) },
    };

    let result;

    if (setLabels) {
      result = await this.contactModel
        .updateMany(filter, { $set: { labels: setLabels, tags: setLabels } })
        .exec();
    } else {
      const update: Record<string, unknown> = {};

      if (addLabels.length) {
        update.$addToSet = {
          labels: { $each: addLabels },
          tags: { $each: addLabels },
        };
      }

      if (removeLabels.length) {
        update.$pull = {
          labels: { $in: removeLabels },
          tags: { $in: removeLabels },
        };
      }

      result = await this.contactModel.updateMany(filter, update).exec();
    }

    return {
      requested: dto.ids.length,
      modified: result.modifiedCount,
    };
  }

  async importCsv(
    file: Express.Multer.File | undefined,
    dto: ImportContactsDto,
    authUser: AuthUser,
  ): Promise<ContactImportResultResponse> {
    if (!file?.buffer?.length) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'CSV_FILE_REQUIRED', 'CSV file is required');
    }

    const workspaceId = await this.resolveWorkspaceId(authUser);

    const source = ContactSource.CSV_IMPORT;
    const parsed = this.contactsImportService.parseCsv(file.buffer, source);

    if (dto.queueOnly) {
      const queuedJob = await this.contactsImportJobService.enqueueImportJob(
        workspaceId,
        file.originalname,
      );

      return {
        created: 0,
        skipped: 0,
        invalid: 0,
        total: parsed.total,
        queuedJob,
      };
    }

    let created = 0;
    let skipped = 0;
    let invalid = 0;
    const invalidRows: Array<{ row: number; reason: string }> = [];
    const skippedRows: Array<{
      row: number;
      name: string;
      email: string;
      phone: string;
      company: string;
      reason: string;
    }> = [];

    for (const row of parsed.rows) {
      try {
        const result = await this.createFromImportRow(workspaceId, row);
        if (result === 'created') {
          created += 1;
        } else {
          skipped += 1;
          skippedRows.push({
            row: row.rowNumber,
            name: this.cleanString(row.fullName) ||
              [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
              this.cleanString(row.email) ||
              this.cleanString(row.phone) ||
              `Row ${row.rowNumber}`,
            email: row.email ?? '',
            phone: row.phone ?? '',
            company: row.company ?? '',
            reason: 'Already exists in system (duplicate)',
          });
        }
      } catch (error) {
        if (error instanceof AppException && this.isDuplicateContactException(error)) {
          skipped += 1;
          skippedRows.push({
            row: row.rowNumber,
            name: this.cleanString(row.fullName) ||
              [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
              this.cleanString(row.email) ||
              this.cleanString(row.phone) ||
              `Row ${row.rowNumber}`,
            email: row.email ?? '',
            phone: row.phone ?? '',
            company: row.company ?? '',
            reason: 'Already exists in system (duplicate)',
          });
          continue;
        }

        invalid += 1;
        invalidRows.push({
          row: row.rowNumber,
          reason: error instanceof AppException 
            ? (error.getResponse() as any).message 
            : error instanceof Error ? error.message : 'Invalid row or missing required fields',
        });
      }
    }

    return {
      created,
      skipped,
      invalid,
      total: parsed.total,
      invalidRows,
      skippedRows,
    };
  }

  private async createFromImportRow(
    workspaceId: string,
    row: ParsedContactCsvRow,
  ): Promise<'created' | 'skipped'> {
    const payload = this.buildContactPayload({
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      company: row.company,
      category: row.category,
      labels: row.labels,
      customFields: row.customFields,
      notes: row.notes,
      source: row.source,
      emailStatus: ContactEmailStatus.UNKNOWN,
      whatsappStatus: ContactWhatsappStatus.UNKNOWN,
      subscriptionStatus: ContactSubscriptionStatus.SUBSCRIBED,
    });

    if (payload.emailNormalized) {
      const existing = await this.contactModel
        .findOne({
          workspaceId: this.toObjectId(workspaceId),
          emailNormalized: payload.emailNormalized,
        })
        .select('_id')
        .lean()
        .exec();

      if (existing) {
        return 'skipped';
      }
    }

    await this.saveWithDuplicateHandling(
      new this.contactModel({
        workspaceId: this.toObjectId(workspaceId),
        ...payload,
      }),
      true,
    );

    if (payload.category) {
      await this.workspacesService.ensureCategories(workspaceId, [payload.category]);
    }

    return 'created';
  }

  private buildContactPayload(input: ContactWriteInput, options: BuildContactPayloadOptions = {}): {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string | null;
    emailNormalized: string;
    phoneNormalized: string | null;
    company: string;
    category: string;
    labels: string[];
    tags: string[];
    customFields: Record<string, unknown>;
    emailStatus: ContactEmailStatus;
    whatsappStatus: ContactWhatsappStatus;
    subscriptionStatus: ContactSubscriptionStatus;
    source: ContactSource;
    notes: string;
  } {
    const firstName = this.cleanString(input.firstName);
    const lastName = this.cleanString(input.lastName);

    const fullName =
      this.cleanString(input.fullName) ||
      [firstName, lastName].filter(Boolean).join(' ').trim();

    const email = this.normalizeEmail(input.email);
    const phone = this.normalizePhone(input.phone);
    const labels = this.normalizeLabels(input.labels ?? []);

    if (!fullName) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'FULL_NAME_REQUIRED', 'Contact Name is required');
    }
    if (!email) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'EMAIL_REQUIRED', 'Email is required');
    }
    if (!this.isValidEmail(email)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_EMAIL', 'A valid email address is required');
    }

    return {
      firstName,
      lastName,
      fullName: fullName!,
      email: email!,
      phone,
      emailNormalized: email!,
      phoneNormalized: phone,
      company: this.cleanString(input.company),
      category: this.normalizeCategory(input.category),
      labels,
      tags: labels,
      customFields: this.normalizeCustomFields(input.customFields),
      emailStatus: input.emailStatus ?? ContactEmailStatus.UNKNOWN,
      whatsappStatus: input.whatsappStatus ?? ContactWhatsappStatus.UNKNOWN,
      subscriptionStatus: input.subscriptionStatus ?? ContactSubscriptionStatus.SUBSCRIBED,
      source: input.source ?? ContactSource.MANUAL,
      notes: this.cleanString(input.notes),
    };
  }

  private toResponse(contact: ContactDocument): ContactResponse {
    const labels = contact.labels?.length ? [...contact.labels] : [...contact.tags];
    const category = contact.category || labels[0] || '';

    return {
      id: contact.id,
      workspaceId: contact.workspaceId.toString(),
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      category,
      labels,
      customFields: this.normalizeCustomFields(contact.customFields),
      emailStatus: contact.emailStatus,
      whatsappStatus: contact.whatsappStatus,
      subscriptionStatus: contact.subscriptionStatus,
      source: contact.source,
      notes: contact.notes,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  private async findOwnedContact(id: string, authUser: AuthUser): Promise<ContactDocument> {
    const workspaceId = await this.resolveWorkspaceId(authUser);

    const contact = await this.contactModel
      .findOne({
        _id: this.toObjectId(id),
        workspaceId: this.toObjectId(workspaceId),
      })
      .exec();

    if (!contact) {
      throw new AppException(HttpStatus.NOT_FOUND, 'CONTACT_NOT_FOUND', 'Contact not found');
    }

    return contact;
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

  private async saveWithDuplicateHandling(
    contact: ContactDocument,
    allowSilentDuplicateSkip = false,
  ): Promise<ContactDocument> {
    if (!contact.email || !this.isValidEmail(contact.email)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'EMAIL_REQUIRED',
        'A valid email address is strictly required for all contacts',
      );
    }

    try {
      return await contact.save();
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        if (allowSilentDuplicateSkip) {
          throw new AppException(
            HttpStatus.CONFLICT,
            'DUPLICATE_CONTACT',
            'Duplicate contact in workspace',
          );
        }

        throw new AppException(
          HttpStatus.CONFLICT,
          'DUPLICATE_CONTACT',
          'Contact with same email already exists in workspace',
        );
      }

      throw error;
    }
  }

  private normalizeEmail(email?: string | null): string | null {
    const value = this.cleanString(email);
    if (!value || value === '-' || value.toLowerCase() === 'n/a') {
      return null;
    }
    return value.toLowerCase();
  }

  private isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  private normalizePhone(phone?: string | null): string | null {
    const value = this.cleanString(phone);
    if (!value) {
      return null;
    }

    let normalized = value.replace(/[^\d+]/g, '');
    if (normalized.startsWith('+')) {
      normalized = `+${normalized.slice(1).replace(/\+/g, '')}`;
    } else {
      normalized = normalized.replace(/\+/g, '');
    }

    return normalized || null;
  }

  private normalizeLabels(labels: string[]): string[] {
    const normalized = labels.map((label) => this.normalizeLabel(label)).filter(Boolean);

    return Array.from(new Set(normalized));
  }

  private normalizeLabel(label: string): string {
    return this.cleanString(label).toLowerCase();
  }

  private normalizeCategory(category?: string): string {
    return this.cleanString(category).toLowerCase();
  }

  private normalizeCustomFields(
    customFields: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    if (!customFields || Array.isArray(customFields) || typeof customFields !== 'object') {
      return {};
    }

    return customFields;
  }

  private cleanString(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
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

  private isDuplicateContactException(exception: AppException): boolean {
    const response = exception.getResponse() as { code?: string };
    return response.code === 'DUPLICATE_CONTACT';
  }
}
