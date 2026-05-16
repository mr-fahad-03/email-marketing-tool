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
// High contrast for Light Theme
// ---------------------------------------------------------------------------
const STATUS_META: Record<PreviewRowStatus, { label: string; color: string }> = {
  valid:        { label: 'Valid',          color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  missing_name: { label: 'Missing Name',   color: 'text-amber-700 bg-amber-50 border-amber-200' },
  skipped:      { label: 'Skipped',        color: 'text-zinc-600 bg-zinc-50 border-zinc-200' },
  rejected:     { label: 'Rejected',       color: 'text-rose-700 bg-rose-50 border-rose-200' },
};

function StatusBadge({ status }: { status: PreviewRowStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-tight shadow-sm ${meta.color}`}>
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

  // Stat cards with high-contrast colors
  const cards: StatCard[] = [
    {
      id: 'all',
      label: 'Total Rows',
      count: result.total,
      icon: <Loader2 className="h-5 w-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      activeBg: 'bg-blue-100 border-blue-400',
    },
    {
      id: 'valid',
      label: 'Valid',
      count: result.counts.valid,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      activeBg: 'bg-emerald-100 border-emerald-400',
    },
    {
      id: 'missing_name',
      label: 'Missing Fields',
      count: result.counts.missing_name,
      icon: <FileWarning className="h-5 w-5" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      activeBg: 'bg-amber-100 border-amber-400',
    },
    {
      id: 'skipped',
      label: 'Skipped',
      count: result.counts.skipped,
      icon: <SkipForward className="h-5 w-5" />,
      color: 'text-zinc-600',
      bgColor: 'bg-zinc-100',
      borderColor: 'border-zinc-300',
      activeBg: 'bg-zinc-200 border-zinc-500',
    },
    {
      id: 'rejected',
      label: 'Rejected',
      count: result.counts.rejected,
      icon: <XCircle className="h-5 w-5" />,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      activeBg: 'bg-rose-100 border-rose-400',
    },
  ];

  const pendingCount = result.counts.valid + result.counts.missing_name;

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
    if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="ml-1 inline h-3 w-3 text-blue-600 stroke-[3px]" />
      : <ChevronDown className="ml-1 inline h-3 w-3 text-blue-600 stroke-[3px]" />;
  };

  const importableCount = result.counts.valid + result.counts.missing_name;

  return (
    <div className="flex flex-col gap-6">

      {/* ── File info banner ── */}
      <div className="flex flex-col gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-black text-blue-900 tracking-tight uppercase">
            Import Preview
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-zinc-600">
            <span className="flex items-center gap-1.5">
              File: <span className="text-zinc-900">{fileName}</span>
            </span>
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
            <span><span className="text-zinc-900">{result.total}</span> total rows</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
            <span className="text-emerald-700 font-black tracking-tight underline underline-offset-2 decoration-emerald-200">{importableCount} will be imported</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result.counts.rejected > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-100 px-3.5 py-1.5 text-xs font-black text-rose-700 shadow-sm">
              <AlertTriangle className="h-3.5 w-3.5" />
              {result.counts.rejected} REJECTED
            </span>
          )}
          {result.counts.missing_name > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-black text-amber-700 shadow-sm">
              <FileWarning className="h-3.5 w-3.5" />
              {result.counts.missing_name} MISSING NAME
            </span>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const isActive = activeFilter === card.id;
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className={[
                'group relative flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all duration-300',
                'hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-500/10',
                isActive
                  ? `${card.activeBg} shadow-lg ring-2 ring-blue-500/20`
                  : `bg-white ${card.borderColor} hover:${card.activeBg} shadow-sm`,
              ].join(' ')}
            >
              <div className={`${card.color} transition-transform duration-300 group-hover:scale-110`}>
                {card.icon}
              </div>
              <div>
                <p className={`text-3xl font-black tabular-nums leading-none ${card.color}`}>
                  {card.count.toLocaleString()}
                </p>
                <p className="mt-2 text-[11px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
                  {card.label}
                </p>
              </div>
            </button>
          );
        })}

        {/* Pending card — highlight */}
        <button
          onClick={() => handleCardClick('all')}
          className="group relative flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1 focus:outline-none shadow-sm"
        >
          <div className="text-violet-600 transition-transform duration-300 group-hover:scale-110">
            <Loader2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-3xl font-black tabular-nums text-violet-600 leading-none">
              {pendingCount.toLocaleString()}
            </p>
            <p className="mt-2 text-[11px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Ready to Import</p>
          </div>
        </button>
      </div>

      {/* ── Filter label ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-zinc-800 uppercase tracking-tight">
            {activeFilter === 'all' ? 'All Preview Rows' : cards.find(c => c.id === activeFilter)?.label ?? activeFilter}
          </span>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-[10px] font-black text-white uppercase tracking-wider">
            {filteredRows.length} ROWS
          </span>
        </div>
        {activeFilter !== 'all' && (
          <button
            onClick={() => handleCardClick('all')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 underline underline-offset-4 decoration-blue-200"
          >
            Show all rows
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-800">
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
                    className="cursor-pointer select-none whitespace-nowrap px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400 hover:text-white transition-colors"
                    onClick={() => handleSort(key)}
                  >
                    {label}
                    <SortIcon col={key} />
                  </th>
                ))}
                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-24 text-center text-sm font-bold text-zinc-400 uppercase italic tracking-widest">
                    No rows match this filter.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, idx) => (
                  <tr
                    key={row.rowNumber}
                    className={[
                      'border-b border-zinc-100 transition-colors hover:bg-zinc-50',
                      idx % 2 !== 0 ? 'bg-zinc-50/30' : 'bg-white',
                    ].join(' ')}
                  >
                    <td className="px-5 py-4 text-[12px] font-bold tabular-nums text-zinc-400">
                      #{row.rowNumber}
                    </td>
                    <td className="max-w-[160px] truncate px-5 py-4 font-black text-zinc-900">
                      {row.name || <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="max-w-[180px] truncate px-5 py-4 font-bold text-zinc-700">
                      {row.email || <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-bold text-zinc-700">
                      {row.phone || <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="max-w-[140px] truncate px-5 py-4 font-bold text-zinc-600">
                      {row.company || <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="max-w-[120px] truncate px-5 py-4 font-bold text-zinc-600">
                      {row.category || <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="max-w-[220px] px-5 py-4 text-xs font-bold text-zinc-500 italic">
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
          <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4 bg-zinc-50/50">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Page {page} of {totalPages} · {filteredRows.length} rows
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-100 hover:border-zinc-300 shadow-sm disabled:cursor-not-allowed disabled:opacity-30"
              >
                PREVIOUS
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-100 hover:border-zinc-300 shadow-sm disabled:cursor-not-allowed disabled:opacity-30"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="sticky bottom-4 z-10 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 px-8 py-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-black text-white tracking-tight">
            Ready to import{' '}
            <span className="text-emerald-400">{importableCount}</span> contacts
          </p>
          <p className="mt-0.5 text-xs font-bold text-zinc-400 uppercase tracking-widest">
            {result.counts.skipped > 0 && `${result.counts.skipped} empty rows skipped · `}
            {result.counts.rejected > 0 && `${result.counts.rejected} rejected rows skipped`}
            {result.counts.skipped === 0 && result.counts.rejected === 0 && 'All detected rows will be imported.'}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isImporting}
            className="rounded-2xl border border-zinc-700 bg-transparent px-6 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white hover:border-zinc-500 disabled:opacity-30"
          >
            ✕ Cancel
          </button>
          <button
            type="button"
            onClick={onStartImport}
            disabled={isImporting || importableCount === 0}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3 text-sm font-black text-white transition hover:bg-emerald-500 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shadow-xl shadow-emerald-900/20"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                IMPORTING...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                START IMPORT
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
