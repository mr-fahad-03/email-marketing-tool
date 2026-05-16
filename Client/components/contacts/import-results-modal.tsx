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

interface ImportResultsModalProps {
  result: ContactsImportResult;
  fileName: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Stat card
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
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${bgClass} ${borderClass}`}>
      <div className={`${colorClass} opacity-80`}>{icon}</div>
      <div>
        <p className={`text-2xl font-bold tabular-nums leading-none ${colorClass}`}>
          {count.toLocaleString()}
        </p>
        <p className="mt-1.5 text-xs font-medium text-zinc-400 leading-snug">{label}</p>
      </div>
      {badgeText && (
        <span
          className={`self-start rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${borderClass} ${colorClass}`}
        >
          {badgeText}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable section
// The header is a plain <div> to avoid the button-in-button hydration error.
// Only the toggle area (left portion) is keyboard/click-interactive.
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
    <div className={`overflow-hidden rounded-xl border ${borderColor} bg-zinc-900/70`}>
      {/* Header row — plain div so actionSlot buttons are NOT nested inside a button */}
      <div className="flex w-full items-center justify-between px-4 py-3">
        {/* Toggle trigger — only this area toggles open/close */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left focus:outline-none"
          aria-expanded={open}
        >
          <span className={`text-sm font-semibold ${colorClass}`}>{title}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${borderColor} ${colorClass}`}
          >
            {count}
          </span>
        </button>

        {/* Right-side controls — separate from the toggle button */}
        <div className="flex items-center gap-3 ml-3">
          {open && actionSlot}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
            aria-label={open ? 'Collapse section' : 'Expand section'}
          >
            <span>{open ? 'Hide' : 'Show'}</span>
            {open
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="border-t border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paginated table
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
            <tr className="bg-zinc-900/80 border-b border-zinc-800">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
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
                  'border-t border-zinc-800/50 transition-colors hover:bg-zinc-800/25',
                  idx % 2 !== 0 ? 'bg-zinc-800/10' : '',
                ].join(' ')}
              >
                {cells.map((cell, ci) => (
                  <td key={ci} className="max-w-[200px] truncate px-4 py-2.5 text-xs text-zinc-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="py-8 text-center text-xs text-zinc-600">
                  No records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2.5">
          <span className="text-xs text-zinc-500">
            Page {page} / {totalPages} · {rows.length} rows
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
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
// Success rate bar — standalone sub-component for clarity
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
  // Pick label colour based on rate
  const rateColor =
    rate === 100
      ? 'text-emerald-400'
      : rate >= 50
        ? 'text-amber-400'
        : 'text-rose-400';

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/30 p-4">
      {/* Title row */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-200">Import Success Rate</p>
        <span className={`text-lg font-extrabold tabular-nums ${rateColor}`}>{rate}%</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-700/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
          style={{ width: `${rate}%` }}
        />
      </div>

      {/* Legend pills */}
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-emerald-300">{created} imported</span>
        </span>
        {skipped > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-amber-300">{skipped} skipped (duplicates)</span>
          </span>
        )}
        {invalid > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
            <span className="text-rose-300">{invalid} rejected</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------
export function ImportResultsModal({ result, fileName, onClose }: ImportResultsModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900 shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <FileText className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Import Results</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {fileName} &middot; {result.total} total rows processed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasAnyIssues && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 hover:border-zinc-500"
              >
                <Download className="h-3.5 w-3.5" />
                Download All Issues
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Success rate bar */}
          <SuccessRateBar
            rate={importSuccessRate}
            created={result.created}
            skipped={result.skipped}
            invalid={result.invalid}
          />

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Successfully Imported"
              count={result.created}
              icon={<CheckCircle2 className="h-5 w-5" />}
              colorClass="text-emerald-400"
              borderClass="border-emerald-500/25"
              bgClass="bg-emerald-500/8"
            />
            <StatCard
              label="Skipped (Duplicates)"
              count={result.skipped}
              icon={<SkipForward className="h-5 w-5" />}
              colorClass="text-amber-400"
              borderClass="border-amber-500/25"
              bgClass="bg-amber-500/8"
              badgeText={hasSkipped ? 'See details ↓' : undefined}
            />
            <StatCard
              label="Rejected / Errors"
              count={result.invalid}
              icon={<XCircle className="h-5 w-5" />}
              colorClass="text-rose-400"
              borderClass="border-rose-500/25"
              bgClass="bg-rose-500/8"
              badgeText={hasInvalid ? 'See details ↓' : undefined}
            />
            <StatCard
              label="Total Rows"
              count={result.total}
              icon={<FileText className="h-5 w-5" />}
              colorClass="text-blue-400"
              borderClass="border-blue-500/25"
              bgClass="bg-blue-500/8"
            />
          </div>

          {/* ── Skipped duplicates expandable section ── */}
          {hasSkipped && (
            <ExpandableSection
              title="Skipped — Duplicate Contacts"
              count={skippedRows.length}
              colorClass="text-amber-400"
              borderColor="border-amber-500/25"
              defaultOpen
              actionSlot={
                <button
                  type="button"
                  onClick={handleDownloadSkipped}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20 hover:border-amber-500/50"
                >
                  <Download className="h-3 w-3" />
                  Download CSV
                </button>
              }
            >
              {/* Info banner */}
              <div className="flex items-start gap-3 border-b border-zinc-800 bg-amber-500/5 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                <p className="text-xs leading-relaxed text-zinc-300">
                  These contacts already exist in your system and were{' '}
                  <strong className="font-semibold text-amber-300">not re-imported</strong> to
                  prevent duplicates. Review the list below or download it to clean up your
                  original CSV.
                </p>
              </div>

              <PaginatedTable
                headers={['Row', 'Name', 'Email', 'Phone', 'Company', 'Status']}
                rows={skippedRows.map((r) => [
                  <span key="row" className="font-mono text-[11px] text-zinc-500">#{r.row}</span>,
                  <span key="name" className="font-medium text-zinc-100">{r.name || '—'}</span>,
                  <span key="email" className="text-zinc-300">{r.email || <span className="text-zinc-600">—</span>}</span>,
                  <span key="phone" className="text-zinc-300">{r.phone || <span className="text-zinc-600">—</span>}</span>,
                  <span key="company" className="text-zinc-400">{r.company || <span className="text-zinc-600">—</span>}</span>,
                  <span
                    key="status"
                    className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
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
              colorClass="text-rose-400"
              borderColor="border-rose-500/25"
              defaultOpen={!hasSkipped}
              actionSlot={
                <button
                  type="button"
                  onClick={handleDownloadInvalid}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 hover:border-rose-500/50"
                >
                  <Download className="h-3 w-3" />
                  Download CSV
                </button>
              }
            >
              <PaginatedTable
                headers={['Row', 'Status', 'Error Reason']}
                rows={invalidRows.map((r) => [
                  <span key="row" className="font-mono text-[11px] text-zinc-500">#{r.row}</span>,
                  <span
                    key="status"
                    className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300"
                  >
                    Rejected
                  </span>,
                  <span key="reason" className="text-zinc-300">{r.reason}</span>,
                ])}
              />
            </ExpandableSection>
          )}

          {/* No issues state */}
          {!hasAnyIssues && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-emerald-300">All contacts imported cleanly</p>
                <p className="mt-1 text-xs text-zinc-500">No duplicates or errors were detected.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end border-t border-zinc-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-700 px-6 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-600 active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
