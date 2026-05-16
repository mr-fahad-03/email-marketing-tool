/**
 * Client-side CSV preview parser.
 * Mirrors the column aliases used by the server (contacts-import.service.ts)
 * and classifies each row so the Import Preview Dashboard can show stats.
 */

export type PreviewRowStatus =
  | 'valid'          // Has Name and Email + all common optional fields
  | 'missing_fields' // Has Name and Email but missing some optional fields
  | 'skipped'        // All key fields blank (genuinely empty row)
  | 'duplicate'      // Email already seen in this file
  | 'rejected';      // Missing Name or Email (mandatory fields)

export interface ParsedPreviewRow {
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  category: string;
  status: PreviewRowStatus;
  reason: string;
  /** Raw cell values keyed by header name */
  raw: Record<string, string>;
}

export interface CsvPreviewResult {
  rows: ParsedPreviewRow[];
  total: number;
  counts: {
    valid: number;
    missing_fields: number;
    skipped: number;
    duplicate: number;
    rejected: number;
  };
}

// ---------------------------------------------------------------------------
// Minimal CSV tokenizer (handles quoted fields, CRLF and LF line endings)
// ---------------------------------------------------------------------------
function tokenizeCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  // Normalize BOM
  const content = text.startsWith('\uFEFF') ? text.slice(1) : text;

  while (i < content.length) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          // Escaped quote
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ',') {
      row.push(cell.trim());
      cell = '';
      i++;
      continue;
    }

    if (ch === '\r' && content[i + 1] === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      i += 2;
      continue;
    }

    if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      i++;
      continue;
    }

    cell += ch;
    i++;
  }

  // Push the last cell / row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Column alias resolution — mirrors the server's ContactsImportService
// ---------------------------------------------------------------------------
const NAME_KEYS = [
  'fullname', 'full_name', 'contact name', 'contactname', 'name',
  'firstname', 'first_name', 'lastname', 'last_name', 'first', 'last'
];
const EMAIL_KEYS = ['email', 'email address', 'email_address', 'e-mail', 'mail', 'emailaddress'];
const PHONE_KEYS = [
  'mobile', 'mobile number', 'mobile_number', 'telephone', 'phone', 'phone number', 'phone_number', 
  'additional number', 'additional_number', 'additionalnumber', 'tel', 'cell'
];
const COMPANY_KEYS = ['company', 'organization', 'org', 'business'];
const CATEGORY_KEYS = ['category', 'categories', 'group', 'groups', 'type'];

function resolveValue(record: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const val = record[key.toLowerCase()];
    if (val && val.trim().length > 0) {
      const trimmed = val.trim();
      if (trimmed === '-' || trimmed.toLowerCase() === 'n/a') continue;
      return trimmed;
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Row classifier
// ---------------------------------------------------------------------------
function classifyRow(
  rowNumber: number,
  record: Record<string, string>,
  isDuplicate: boolean = false,
  isServerDuplicate: boolean = false,
): ParsedPreviewRow {
  const name = resolveValue(record, NAME_KEYS);
  const email = resolveValue(record, EMAIL_KEYS);
  const phone = resolveValue(record, PHONE_KEYS);
  const company = resolveValue(record, COMPANY_KEYS);
  const category = resolveValue(record, CATEGORY_KEYS);

  const hasEmail = !!email;
  const hasName = !!name;
  const hasIdentifier = !!(name || company || email || phone);
  const isBlank = !hasIdentifier;

  let status: PreviewRowStatus;
  let reason: string;

  if (isBlank) {
    status = 'skipped';
    reason = 'Row is empty — all key fields are blank';
  } else if (!hasEmail) {
    status = 'rejected';
    reason = 'Email is required — contacts must have an email address';
  } else if (!hasName) {
    status = 'rejected';
    reason = 'Name is required — contacts must have a name';
  } else if (isDuplicate) {
    status = 'duplicate';
    reason = 'Duplicate email found in this file';
  } else if (isServerDuplicate) {
    status = 'duplicate';
    reason = 'Contact already exists in your workspace';
  } else {
    // Both Name and Email are present
    const isMissingOptional = !phone || !company || !category;
    if (isMissingOptional) {
      status = 'missing_fields';
      reason = 'Some optional fields are missing (Mobile, Company, or Category)';
    } else {
      status = 'valid';
      reason = 'Ready to import';
    }
  }

  return {
    rowNumber,
    name: name || company || email || phone || '—',
    email,
    phone,
    company,
    category,
    status,
    reason,
    raw: record,
  };
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------
export async function parseCsvForPreview(
  file: File,
  serverExistingEmails: string[] = [],
): Promise<CsvPreviewResult> {
  const text = await file.text();
  const allRows = tokenizeCsv(text);

  if (allRows.length < 2) {
    return {
      rows: [],
      total: 0,
    counts: { valid: 0, missing_fields: 0, skipped: 0, duplicate: 0, rejected: 0 },
    };
  }

  // First row = headers
  const headers = allRows[0].map((h) => h.toLowerCase().trim());
  const dataRows = allRows.slice(1);

  const parsedRows: ParsedPreviewRow[] = [];
  const counts = { valid: 0, missing_fields: 0, skipped: 0, duplicate: 0, rejected: 0 };
  const seenEmails = new Set<string>();
  const serverEmailsSet = new Set(serverExistingEmails.map((e) => e.toLowerCase()));

  dataRows.forEach((cells, index) => {
    // Build record object keyed by lowercase header
    const record: Record<string, string> = {};
    headers.forEach((header, col) => {
      record[header] = cells[col]?.trim() ?? '';
    });

    const email = resolveValue(record, EMAIL_KEYS).toLowerCase();
    const isDuplicate = email ? seenEmails.has(email) : false;
    const isServerDuplicate = email ? serverEmailsSet.has(email) : false;
    
    if (email && !isDuplicate) {
      seenEmails.add(email);
    }

    const row = classifyRow(index + 2, record, isDuplicate, isServerDuplicate); // rowNumber starts at 2 (1 = header)
    parsedRows.push(row);
    counts[row.status] += 1;
  });

  return {
    rows: parsedRows,
    total: parsedRows.length,
    counts,
  };
}

/**
 * Quick pass to extract all emails from a CSV for server-side duplicate checking.
 */
export async function extractEmailsFromCsv(file: File): Promise<string[]> {
  const text = await file.text();
  const allRows = tokenizeCsv(text);

  if (allRows.length < 2) return [];

  const headers = allRows[0].map((h) => h.toLowerCase().trim());
  const dataRows = allRows.slice(1);
  const emails: string[] = [];

  dataRows.forEach((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, col) => {
      record[header] = cells[col]?.trim() ?? '';
    });
    const email = resolveValue(record, EMAIL_KEYS);
    if (email) emails.push(email);
  });

  return Array.from(new Set(emails));
}
