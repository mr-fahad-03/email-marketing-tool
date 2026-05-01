import { HttpStatus, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { AppException } from '../../common/exceptions/app.exception';
import { ContactSource } from './constants/contact.enums';

export interface ParsedContactCsvRow {
  rowNumber: number;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  category?: string;
  labels?: string[];
  customFields?: Record<string, unknown>;
  notes?: string;
  source?: ContactSource;
}

@Injectable()
export class ContactsImportService {
  parseCsv(
    fileBuffer: Buffer,
    defaultSource: ContactSource,
  ): { rows: ParsedContactCsvRow[]; total: number } {
    const content = fileBuffer.toString('utf8');

    let records: Array<Record<string, unknown>>;
    try {
      records = parse(content, {
        columns: true,
        trim: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true,
      }) as Array<Record<string, unknown>>;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid CSV file';
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_CSV', message);
    }

    const rows = records.map((record, index) => this.mapRecord(record, index + 2, defaultSource));

    return {
      rows,
      total: records.length,
    };
  }

  private mapRecord(
    record: Record<string, unknown>,
    rowNumber: number,
    defaultSource: ContactSource,
  ): ParsedContactCsvRow {
    const normalizedRecord = this.normalizeRecordKeys(record);

    const parsedCategory = this.parseList(this.readValue(normalizedRecord, ['category', 'categories']));
    const parsedLabels = this.parseList(this.readValue(normalizedRecord, ['labels', 'label', 'tags']));
    const firstName = this.readValue(normalizedRecord, ['firstname', 'first_name']);
    const lastName = this.readValue(normalizedRecord, ['lastname', 'last_name']);
    const fullNameFromColumns = this.readValue(normalizedRecord, [
      'fullname',
      'full_name',
      'contact name',
      'contactname',
      'name',
    ]);
    const fullNameFromSplitNames = [firstName, lastName].filter(Boolean).join(' ').trim();
    const fullName = fullNameFromColumns ?? (fullNameFromSplitNames || undefined);
    const telephone = this.readValue(normalizedRecord, ['telephone', 'phone', 'phone number']);
    const mobile = this.readValue(normalizedRecord, ['mobile', 'mobile number']);
    const additionalNumber = this.readValue(normalizedRecord, ['additional number', 'additionalnumber']);
    const city = this.readValue(normalizedRecord, ['city']);
    const country = this.readValue(normalizedRecord, ['country']);
    const designation = this.readValue(normalizedRecord, ['designation', 'desigination']);
    const department = this.readValue(normalizedRecord, ['department']);
    const leadSource = this.readValue(normalizedRecord, ['source']);

    return {
      rowNumber,
      firstName,
      lastName,
      fullName,
      email: this.readValue(normalizedRecord, ['email']),
      phone:
        mobile ??
        telephone ??
        additionalNumber ??
        this.readValue(normalizedRecord, ['phonenumber', 'phone_number']),
      company: this.readValue(normalizedRecord, ['company']),
      category: parsedCategory?.[0],
      labels: parsedLabels,
      customFields: this.buildCustomFields({
        parsedJsonCustomFields: this.parseCustomFields(
          this.readValue(normalizedRecord, ['customfields', 'custom_fields']),
        ),
        telephone,
        mobile,
        additionalNumber,
        country,
        city,
        designation,
        department,
        leadSource,
      }),
      notes: this.readValue(normalizedRecord, ['notes']),
      source: this.parseSource(this.readValue(normalizedRecord, ['source']), defaultSource),
    };
  }

  private buildCustomFields(input: {
    parsedJsonCustomFields?: Record<string, unknown>;
    telephone?: string;
    mobile?: string;
    additionalNumber?: string;
    country?: string;
    city?: string;
    designation?: string;
    department?: string;
    leadSource?: string;
  }): Record<string, unknown> | undefined {
    const customFields: Record<string, unknown> = {
      ...(input.parsedJsonCustomFields ?? {}),
    };

    if (input.telephone) {
      customFields.telephone = input.telephone;
    }
    if (input.mobile) {
      customFields.mobile = input.mobile;
    }
    if (input.additionalNumber) {
      customFields.additionalNumber = input.additionalNumber;
    }
    if (input.country) {
      customFields.country = input.country;
    }
    if (input.city) {
      customFields.city = input.city;
    }
    if (input.designation) {
      customFields.designation = input.designation;
    }
    if (input.department) {
      customFields.department = input.department;
    }
    if (input.leadSource) {
      customFields.leadSource = input.leadSource;
    }

    return Object.keys(customFields).length ? customFields : undefined;
  }

  private normalizeRecordKeys(record: Record<string, unknown>): Record<string, string> {
    return Object.entries(record).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key.toLowerCase().trim()] =
        typeof value === 'string' ? value.trim() : String(value ?? '');
      return acc;
    }, {});
  }

  private readValue(record: Record<string, string>, keys: string[]): string | undefined {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== '') {
        return record[key];
      }
    }

    return undefined;
  }

  private parseList(value: string | undefined): string[] | undefined {
    if (!value) {
      return undefined;
    }

    return value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseCustomFields(value: string | undefined): Record<string, unknown> | undefined {
    if (!value) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private parseSource(value: string | undefined, defaultSource: ContactSource): ContactSource {
    if (!value) {
      return defaultSource;
    }

    const normalized = value.toLowerCase().trim();
    switch (normalized) {
      case ContactSource.MANUAL:
      case ContactSource.CSV_IMPORT:
      case ContactSource.API:
      case ContactSource.WEBHOOK:
        return normalized;
      default:
        return defaultSource;
    }
  }
}
