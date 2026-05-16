'use client';

import {
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  FileText,
  X,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import type { ContactsImportResult } from '@/lib/types/contact';

interface ImportResultsViewProps {
  result: ContactsImportResult;
  fileName: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Stat card
// Optimized for Light Theme with high contrast text
// ---------------------------------------------------------------------------
function StatCard({
  label,
  count,
  icon,
  colorClass,
  borderClass,
  bgClass,
  badgeText,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  badgeText?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${bgClass} ${borderClass}`}>
      <div className={colorClass}>{icon}</div>
      <div>
        <p className={`text-2xl font-bold tabular-nums leading-none ${colorClass}`}>
          {count.toLocaleString()}
        </p>
        <p className="mt-2 text-xs font-bold text-zinc-700 leading-tight uppercase tracking-wide">
          {label}
        </p>
      </div>
      {badgeText && (
        <span
          className={`self-start rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${borderClass} ${colorClass} bg-white/50 backdrop-blur-sm`}
        >
          {badgeText}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable section
// Header is a div, toggle is a button. Clean, high-contrast light theme.
// ---------------------------------------------------------------------------
function ExpandableSection({
  title,
  count,
  colorClass,
  borderColor,
  children,
  defaultOpen = false,
  actionSlot,
}: {
  title: string;
  count: number;
  colorClass: string;
  borderColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  actionSlot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-sm ${borderColor}`}>
      {/* Header row */}
      <div className="flex w-full items-center justify-between px-5 py-3.5 bg-zinc-50/50">
        {/* Toggle trigger */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 text-left focus:outline-none group"
          aria-expanded={open}
        >
          <span className={`text-sm font-bold tracking-tight ${colorClass}`}>{title}</span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-black tabular-nums bg-white shadow-sm ${borderColor} ${colorClass}`}
          >
            {count}
          </span>
        </button>

        {/* Right-side controls */}
        <div className="flex items-center gap-4 ml-4">
          {open && actionSlot}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 transition-colors focus:outline-none"
            aria-label={open ? 'Collapse section' : 'Expand section'}
          >
            <span>{open ? 'Hide' : 'Show'}</span>
            {open
              ? <ChevronUp className="h-4 w-4 stroke-[2.5px]" />
              : <ChevronDown className="h-4 w-4 stroke-[2.5px]" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="border-t border-zinc-100 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paginated table
// Dark header, Light body for maximum readability
// ---------------------------------------------------------------------------
function PaginatedTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-800 border-b border-zinc-900">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-300"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((cells, idx) => (
              <tr
                key={idx}
                className={[
                  'border-b border-zinc-100 transition-colors hover:bg-zinc-50',
                  idx % 2 !== 0 ? 'bg-zinc-50/50' : 'bg-white',
                ].join(' ')}
              >
                {cells.map((cell, ci) => (
                  <td key={ci} className="max-w-[200px] truncate px-4 py-3 text-[13px] font-medium text-zinc-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="py-12 text-center text-sm font-medium text-zinc-400 italic">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 bg-zinc-50/30">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
            Page {page} / {totalPages} · {rows.length} rows
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV download helpers
// ---------------------------------------------------------------------------
function buildCsv(rows: string[][]): string {
  return rows
    .map((cells) =>
      cells.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
    )
    .join('\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Success rate bar
// Redesigned for extreme clarity and contrast
// ---------------------------------------------------------------------------
function SuccessRateBar({
  rate,
  created,
  skipped,
  invalid,
}: {
  rate: number;
  created: number;
  skipped: number;
  invalid: number;
}) {
  const rateColor =
    rate === 100
      ? 'text-emerald-600'
      : rate >= 50
        ? 'text-amber-600'
        : 'text-rose-600';

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 shadow-inner">
      {/* Title row */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-bold text-zinc-800 uppercase tracking-tight">Import Success Rate</p>
        <span className={`text-2xl font-black tabular-nums ${rateColor}`}>{rate}%</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-zinc-200 shadow-inner">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-out"
          style={{ width: `${rate}%` }}
        />
      </div>

      {/* Legend pills */}
      <div className="mt-4 flex flex-wrap gap-4">
        <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-100 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-zinc-700">{created} imported</span>
        </span>
        {skipped > 0 && (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-100 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-xs font-bold text-zinc-700">{skipped} skipped</span>
          </span>
        )}
        {invalid > 0 && (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-100 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="text-xs font-bold text-zinc-700">{invalid} rejected</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// Switched to Light Theme with professional zinc/color accents
// ---------------------------------------------------------------------------
export function ImportResultsView({ result, fileName, onClose }: ImportResultsViewProps) {
  const skippedRows  = result.skippedRows ?? [];
  const invalidRows  = result.invalidRows ?? [];
  const hasSkipped   = skippedRows.length > 0;
  const hasInvalid   = invalidRows.length > 0;
  const hasAnyIssues = hasSkipped || hasInvalid;

  const importSuccessRate =
    result.total > 0 ? Math.round((result.created / result.total) * 100) : 0;

  // ── Download handlers ──
  const handleDownloadSkipped = () => {
    const header = ['Row', 'Name', 'Email', 'Phone', 'Company', 'Status', 'Reason'];
    const data = skippedRows.map((r) => [
      String(r.row), r.name, r.email, r.phone, r.company, 'Skipped (Duplicate)', r.reason,
    ]);
    downloadCsv(`skipped-duplicates-${Date.now()}.csv`, buildCsv([header, ...data]));
  };

  const handleDownloadInvalid = () => {
    const header = ['Row', 'Status', 'Reason'];
    const data = invalidRows.map((r) => [String(r.row), 'Rejected', r.reason]);
    downloadCsv(`rejected-errors-${Date.now()}.csv`, buildCsv([header, ...data]));
  };

  const handleDownloadAll = () => {
    const header = ['Row', 'Name', 'Email', 'Phone', 'Company', 'Status', 'Reason'];
    const skippedData = skippedRows.map((r) => [
      String(r.row), r.name, r.email, r.phone, r.company, 'Skipped (Duplicate)', r.reason,
    ]);
    const invalidData = invalidRows.map((r) => [
      String(r.row), '', '', '', '', 'Rejected / Error', r.reason,
    ]);
    downloadCsv(
      `import-issues-${Date.now()}.csv`,
      buildCsv([header, ...skippedData, ...invalidData]),
    );
  };

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

        {/* ── Header ── */}
        <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5 bg-white">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm">
              <FileText className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-900 tracking-tight">Import Results</h2>
              <p className="text-xs font-bold text-zinc-500 mt-0.5 uppercase tracking-wider">
                {fileName} &middot; {result.total} total rows processed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasAnyIssues && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-black text-zinc-800 transition hover:bg-zinc-100 hover:border-zinc-300 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Download All Issues
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <X className="h-5 w-5 stroke-[2.5px]" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Success rate bar */}
          <SuccessRateBar
            rate={importSuccessRate}
            created={result.created}
            skipped={result.skipped}
            invalid={result.invalid}
          />

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Successfully Imported"
              count={result.created}
              icon={<CheckCircle2 className="h-6 w-6" />}
              colorClass="text-emerald-600"
              borderClass="border-emerald-100"
              bgClass="bg-emerald-50/50"
            />
            <StatCard
              label="Skipped (Duplicates)"
              count={result.skipped}
              icon={<SkipForward className="h-6 w-6" />}
              colorClass="text-amber-600"
              borderClass="border-amber-100"
              bgClass="bg-amber-50/50"
              badgeText={hasSkipped ? 'View Details' : undefined}
            />
            <StatCard
              label="Rejected / Errors"
              count={result.invalid}
              icon={<XCircle className="h-6 w-6" />}
              colorClass="text-rose-600"
              borderClass="border-rose-100"
              bgClass="bg-rose-50/50"
              badgeText={hasInvalid ? 'View Details' : undefined}
            />
            <StatCard
              label="Total Rows"
              count={result.total}
              icon={<FileText className="h-6 w-6" />}
              colorClass="text-blue-600"
              borderClass="border-blue-100"
              bgClass="bg-blue-50/50"
            />
          </div>

          {/* ── Skipped duplicates expandable section ── */}
          {hasSkipped && (
            <ExpandableSection
              title="Skipped — Duplicate Contacts"
              count={skippedRows.length}
              colorClass="text-amber-700"
              borderColor="border-amber-200"
              defaultOpen
              actionSlot={
                <button
                  type="button"
                  onClick={handleDownloadSkipped}
                  className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 hover:border-amber-300"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </button>
              }
            >
              {/* Info banner */}
              <div className="flex items-start gap-4 border-b border-amber-100 bg-amber-50/30 px-5 py-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <p className="text-sm font-medium leading-relaxed text-zinc-700">
                  These contacts already exist in your system and were{' '}
                  <strong className="font-bold text-amber-700 underline decoration-amber-300 underline-offset-4">not re-imported</strong> to
                  prevent duplicates. Review the list below or download it to clean up your
                  original CSV.
                </p>
              </div>

              <PaginatedTable
                headers={['Row', 'Name', 'Email', 'Phone', 'Company', 'Status']}
                rows={skippedRows.map((r) => [
                  <span key="row" className="font-mono text-zinc-400 font-bold">#{r.row}</span>,
                  <span key="name" className="font-bold text-zinc-900">{r.name || '—'}</span>,
                  <span key="email" className="font-medium text-zinc-700">{r.email || <span className="text-zinc-400">—</span>}</span>,
                  <span key="phone" className="font-medium text-zinc-700">{r.phone || <span className="text-zinc-400">—</span>}</span>,
                  <span key="company" className="font-medium text-zinc-600">{r.company || <span className="text-zinc-400">—</span>}</span>,
                  <span
                    key="status"
                    className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-3 py-0.5 text-[11px] font-black text-amber-700 uppercase tracking-tight shadow-sm"
                  >
                    Duplicate
                  </span>,
                ])}
              />
            </ExpandableSection>
          )}

          {/* ── Rejected / errors expandable section ── */}
          {hasInvalid && (
            <ExpandableSection
              title="Rejected — Error Details"
              count={invalidRows.length}
              colorClass="text-rose-700"
              borderColor="border-rose-200"
              defaultOpen={!hasSkipped}
              actionSlot={
                <button
                  type="button"
                  onClick={handleDownloadInvalid}
                  className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 hover:border-rose-300"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </button>
              }
            >
              <PaginatedTable
                headers={['Row', 'Status', 'Error Reason']}
                rows={invalidRows.map((r) => [
                  <span key="row" className="font-mono text-zinc-400 font-bold">#{r.row}</span>,
                  <span
                    key="status"
                    className="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-3 py-0.5 text-[11px] font-black text-rose-700 uppercase tracking-tight shadow-sm"
                  >
                    Rejected
                  </span>,
                  <span key="reason" className="font-bold text-zinc-800">{r.reason}</span>,
                ])}
              />
            </ExpandableSection>
          )}

          {/* No issues state */}
          {!hasAnyIssues && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 py-16 shadow-inner">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white border border-emerald-100 shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-emerald-900 tracking-tight">All contacts imported cleanly</p>
                <p className="mt-2 text-sm font-bold text-zinc-500 uppercase tracking-wide">No duplicates or errors were detected.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end border-t border-zinc-100 px-6 py-5 bg-zinc-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-black px-10 py-3 text-sm font-black text-white transition hover:bg-zinc-700 active:scale-95 shadow-lg uppercase tracking-widest"
          >
            Done
          </button>
        </div>
    </div>
  );
}
