/**
 * Client-side CSV preview parser.
 * Mirrors the column aliases used by the server (contacts-import.service.ts)
 * and classifies each row so the Import Preview Dashboard can show stats.
 */

export type PreviewRowStatus =
  | 'valid'         // Has email/phone + name → will be imported
  | 'missing_name'  // Has email/phone but no resolvable name → import with fallback name
  | 'skipped'       // All key fields blank (genuinely empty row)
  | 'rejected';     // No email AND no phone (has some data, but unusable contact method)

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
    missing_name: number;
    skipped: number;
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
  'firstname', 'first_name', 'lastname', 'last_name',
];
const EMAIL_KEYS = ['email'];
const PHONE_KEYS = ['mobile', 'mobile number', 'telephone', 'phone', 'phone number', 'additional number', 'additionalnumber'];
const COMPANY_KEYS = ['company'];
const CATEGORY_KEYS = ['category', 'categories'];

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
): ParsedPreviewRow {
  const name = resolveValue(record, NAME_KEYS);
  const email = resolveValue(record, EMAIL_KEYS);
  const phone = resolveValue(record, PHONE_KEYS);
  const company = resolveValue(record, COMPANY_KEYS);
  const category = resolveValue(record, CATEGORY_KEYS);

  const hasEmail = !!email;
  const hasIdentifier = !!(name || company || email || phone);
  const isBlank = !hasIdentifier;

  let status: PreviewRowStatus;
  let reason: string;

  if (isBlank) {
    status = 'skipped';
    reason = 'Row is empty — all key fields are blank';
  } else if (!hasEmail) {
    status = 'rejected';
    reason = 'Email is required — contacts cannot be imported without a valid email address';
  } else if (!name && !company) {
    status = 'missing_name';
    reason = 'Name is missing — will use email as display name';
  } else {
    status = 'valid';
    reason = 'Ready to import';
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
export async function parseCsvForPreview(file: File): Promise<CsvPreviewResult> {
  const text = await file.text();
  const allRows = tokenizeCsv(text);

  if (allRows.length < 2) {
    return {
      rows: [],
      total: 0,
      counts: { valid: 0, missing_name: 0, skipped: 0, rejected: 0 },
    };
  }

  // First row = headers
  const headers = allRows[0].map((h) => h.toLowerCase().trim());
  const dataRows = allRows.slice(1);

  const parsedRows: ParsedPreviewRow[] = [];
  const counts = { valid: 0, missing_name: 0, skipped: 0, rejected: 0 };

  dataRows.forEach((cells, index) => {
    // Build record object keyed by lowercase header
    const record: Record<string, string> = {};
    headers.forEach((header, col) => {
      record[header] = cells[col]?.trim() ?? '';
    });

    const row = classifyRow(index + 2, record); // rowNumber starts at 2 (1 = header)
    parsedRows.push(row);
    counts[row.status] += 1;
  });

  return {
    rows: parsedRows,
    total: parsedRows.length,
    counts,
  };
}
