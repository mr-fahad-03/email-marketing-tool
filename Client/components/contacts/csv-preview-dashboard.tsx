'use client';

import {
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  FileWarning,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { CsvPreviewResult, ParsedPreviewRow, PreviewRowStatus } from '@/lib/utils/csv-preview-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FilterStatus = PreviewRowStatus | 'all';

interface StatCard {
  id: FilterStatus;
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  activeBg: string;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
const STATUS_META: Record<PreviewRowStatus, { label: string; color: string }> = {
  valid:        { label: 'Valid',          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  missing_name: { label: 'Missing Name',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  skipped:      { label: 'Skipped',        color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' },
  rejected:     { label: 'Rejected',       color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
};

function StatusBadge({ status }: { status: PreviewRowStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CsvPreviewDashboardProps {
  fileName: string;
  result: CsvPreviewResult;
  isImporting: boolean;
  onStartImport: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------
type SortKey = 'rowNumber' | 'name' | 'email' | 'phone' | 'company' | 'category' | 'status';
type SortDir = 'asc' | 'desc';

function sortRows(rows: ParsedPreviewRow[], key: SortKey, dir: SortDir): ParsedPreviewRow[] {
  return [...rows].sort((a, b) => {
    const av = String(a[key] ?? '');
    const bv = String(b[key] ?? '');
    const cmp = key === 'rowNumber'
      ? (a.rowNumber - b.rowNumber)
      : av.localeCompare(bv, undefined, { sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CsvPreviewDashboard({
  fileName,
  result,
  isImporting,
  onStartImport,
  onCancel,
}: CsvPreviewDashboardProps) {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('rowNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const PAGE_SIZE = 20;

  // Stat cards
  const cards: StatCard[] = [
    {
      id: 'all',
      label: 'Total Rows',
      count: result.total,
      icon: <Loader2 className="h-5 w-5" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      activeBg: 'bg-blue-500/20 border-blue-400',
    },
    {
      id: 'valid',
      label: 'Completed',
      count: result.counts.valid,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      activeBg: 'bg-emerald-500/20 border-emerald-400',
    },
    {
      id: 'missing_name',
      label: 'Missing Fields',
      count: result.counts.missing_name,
      icon: <FileWarning className="h-5 w-5" />,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      activeBg: 'bg-amber-500/20 border-amber-400',
    },
    {
      id: 'skipped',
      label: 'Skipped',
      count: result.counts.skipped,
      icon: <SkipForward className="h-5 w-5" />,
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-500/10',
      borderColor: 'border-zinc-500/30',
      activeBg: 'bg-zinc-500/20 border-zinc-400',
    },
    {
      id: 'rejected',
      label: 'Rejected',
      count: result.counts.rejected,
      icon: <XCircle className="h-5 w-5" />,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      activeBg: 'bg-rose-500/20 border-rose-400',
    },
  ];

  // Pending card (valid + missing_name will be attempted)
  const pendingCount = result.counts.valid + result.counts.missing_name;

  // Filtered + sorted rows
  const filteredRows = useMemo(() => {
    const base =
      activeFilter === 'all'
        ? result.rows
        : result.rows.filter((r) => r.status === activeFilter);
    return sortRows(base, sortKey, sortDir);
  }, [activeFilter, result.rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCardClick = (id: FilterStatus) => {
    setActiveFilter(id);
    setPage(1);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="ml-1 inline h-3 w-3 text-blue-400" />
      : <ChevronDown className="ml-1 inline h-3 w-3 text-blue-400" />;
  };

  const importableCount = result.counts.valid + result.counts.missing_name;

  return (
    <div className="flex flex-col gap-6">

      {/* ── File info banner ── */}
      <div className="flex flex-col gap-1 rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            Import Preview
          </p>
          <p className="text-xs text-zinc-400">
            File: <span className="text-zinc-200">{fileName}</span>
            &nbsp;·&nbsp;
            <span className="text-zinc-200">{result.total}</span> rows detected
            &nbsp;·&nbsp;
            <span className="text-emerald-400">{importableCount}</span> will be imported
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result.counts.rejected > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {result.counts.rejected} rejected
            </span>
          )}
          {result.counts.missing_name > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
              <FileWarning className="h-3.5 w-3.5" />
              {result.counts.missing_name} missing name
            </span>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const isActive = activeFilter === card.id;
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className={[
                'group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200',
                'hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40',
                isActive
                  ? `${card.activeBg} shadow-lg scale-[1.02]`
                  : `${card.bgColor} ${card.borderColor} hover:${card.activeBg}`,
              ].join(' ')}
            >
              {isActive && (
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-current opacity-70 animate-pulse" style={{ color: 'inherit' }} />
              )}
              <div className={`${card.color} transition-transform duration-200 group-hover:scale-110`}>
                {card.icon}
              </div>
              <div>
                <p className={`text-2xl font-bold tabular-nums ${card.color}`}>
                  {card.count.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs font-medium text-zinc-400">
                  {card.label}
                </p>
              </div>
            </button>
          );
        })}

        {/* Pending card — special (not filterable individually) */}
        <button
          onClick={() => handleCardClick('all')}
          className="group relative flex flex-col gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:bg-violet-500/20 hover:shadow-lg focus:outline-none"
        >
          <div className="text-violet-400 transition-transform duration-200 group-hover:scale-110">
            <Loader2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-violet-400">
              {pendingCount.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs font-medium text-zinc-400">Pending Import</p>
          </div>
        </button>
      </div>

      {/* ── Filter label ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-300">
            {activeFilter === 'all' ? 'All Rows' : cards.find(c => c.id === activeFilter)?.label ?? activeFilter}
          </span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {filteredRows.length} rows
          </span>
        </div>
        {activeFilter !== 'all' && (
          <button
            onClick={() => handleCardClick('all')}
            className="text-xs text-blue-400 underline underline-offset-2 hover:text-blue-300"
          >
            Show all
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                {([
                  { key: 'rowNumber', label: 'Row' },
                  { key: 'name',      label: 'Name' },
                  { key: 'email',     label: 'Email' },
                  { key: 'phone',     label: 'Phone' },
                  { key: 'company',   label: 'Company' },
                  { key: 'category',  label: 'Category' },
                  { key: 'status',    label: 'Status' },
                ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                  <th
                    key={key}
                    className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                    onClick={() => handleSort(key)}
                  >
                    {label}
                    <SortIcon col={key} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-zinc-500">
                    No rows match this filter.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, idx) => (
                  <tr
                    key={row.rowNumber}
                    className={[
                      'border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/40',
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-zinc-900/30',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 text-xs tabular-nums text-zinc-500">
                      #{row.rowNumber}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 font-medium text-zinc-200">
                      {row.name || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-zinc-300">
                      {row.email || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                      {row.phone || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-zinc-400">
                      {row.company || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-zinc-400">
                      {row.category || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-xs text-zinc-500">
                      {row.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
            <p className="text-xs text-zinc-500">
              Page {page} of {totalPages} · {filteredRows.length} rows
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-zinc-700/60 bg-zinc-900/95 px-6 py-4 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            Ready to import{' '}
            <span className="text-emerald-400">{importableCount}</span> contacts
          </p>
          <p className="text-xs text-zinc-500">
            {result.counts.skipped > 0 && `${result.counts.skipped} empty rows will be skipped · `}
            {result.counts.rejected > 0 && `${result.counts.rejected} rejected rows will not be imported`}
            {result.counts.skipped === 0 && result.counts.rejected === 0 && 'All rows are ready to import.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isImporting}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
          >
            ✕ Cancel Import
          </button>
          <button
            type="button"
            onClick={onStartImport}
            disabled={isImporting || importableCount === 0}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg hover:shadow-emerald-500/25"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Start Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
