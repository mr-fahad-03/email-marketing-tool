'use client';

import { ArrowLeft, FileSpreadsheet, BarChart2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CsvPreviewDashboard } from '@/components/contacts/csv-preview-dashboard';
import { ImportResultsModal } from '@/components/contacts/import-results-modal';
import { importContacts } from '@/lib/api/contacts';
import { HttpClientError } from '@/lib/api/errors';
import { consumePendingImport, clearPendingImport } from '@/lib/utils/csv-import-store';
import type { ContactsImportResult } from '@/lib/types/contact';
import type { CsvPreviewResult } from '@/lib/utils/csv-preview-parser';

export default function ImportPreviewPage() {
  const router = useRouter();
  const [result, setResult] = useState<CsvPreviewResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ContactsImportResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    const { file, result: previewResult, fileName: name } = consumePendingImport();

    if (!file || !previewResult) {
      router.replace('/dashboard/contacts');
      return;
    }

    fileRef.current = file;
    setResult(previewResult);
    setFileName(name);
  }, [router]);

  const handleCancel = () => {
    clearPendingImport();
    router.push('/dashboard/contacts');
  };

  const handleStartImport = async () => {
    const file = fileRef.current;
    if (!file) {
      toast.error('No file found. Please re-select your CSV and try again.');
      return;
    }

    setIsImporting(true);

    toast.info('Starting import — please wait while the server processes the data...');
    try {
      const completed = await importContacts(file);
      clearPendingImport();

      // Store the result and show the Results button/modal — don't auto-navigate
      setImportResult(completed);
      setShowResults(true);

      toast.success(
        `Import complete — ${completed.created} imported, ${completed.skipped} skipped, ${completed.invalid} rejected`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof HttpClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Import failed. Please try again.';
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleResultsClose = () => {
    setShowResults(false);
    // Navigate back to contacts so the user sees the updated list
    router.push('/dashboard/contacts');
  };

  if (!result) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <FileSpreadsheet className="h-10 w-10 animate-pulse" />
          <p className="text-sm">Loading import preview…</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider">Step 1</span>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Preview (Local Analysis)</span>
            </div>
            <h2 className="text-xl font-semibold text-zinc-100">Import Preview</h2>
            <p className="text-sm text-zinc-400">
              Review your data locally. No contacts have been imported yet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Results button — shown after import completes */}
          {importResult && (
            <button
              type="button"
              onClick={() => setShowResults(true)}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 animate-pulse-once"
            >
              <BarChart2 className="h-4 w-4" />
              View Results
            </button>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-400" />
            <span className="max-w-[200px] truncate text-sm text-zinc-300">{fileName}</span>
          </div>
        </div>
      </div>

      {/* Preview dashboard (still visible after import, dimmed) */}
      <div className={importResult ? 'pointer-events-none opacity-50' : ''}>
        <CsvPreviewDashboard
          fileName={fileName}
          result={result}
          isImporting={isImporting}
          onStartImport={() => void handleStartImport()}
          onCancel={handleCancel}
        />
      </div>

      {/* Results modal */}
      {showResults && importResult && (
        <ImportResultsModal
          result={importResult}
          fileName={fileName}
          onClose={handleResultsClose}
        />
      )}
    </section>
  );
}
