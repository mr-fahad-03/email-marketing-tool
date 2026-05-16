/**
 * Module-level in-memory store for the pending CSV import.
 * Since File objects can't be serialized to sessionStorage, we keep them
 * in a module singleton that survives client-side navigation within the same tab.
 */
import type { CsvPreviewResult } from '@/lib/utils/csv-preview-parser';

let _pendingFile: File | null = null;
let _pendingResult: CsvPreviewResult | null = null;
let _pendingFileName: string = '';

/** Set by the contacts page before navigating to the import preview page. */
export function setPendingImport(file: File, result: CsvPreviewResult): void {
  _pendingFile = file;
  _pendingResult = result;
  _pendingFileName = file.name;
}

/** Read by the import preview page on mount. */
export function consumePendingImport(): {
  file: File | null;
  result: CsvPreviewResult | null;
  fileName: string;
} {
  return {
    file: _pendingFile,
    result: _pendingResult,
    fileName: _pendingFileName,
  };
}

/** Clear after import is done or cancelled. */
export function clearPendingImport(): void {
  _pendingFile = null;
  _pendingResult = null;
  _pendingFileName = '';
}
