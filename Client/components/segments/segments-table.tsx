import { Edit3, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Segment } from '@/lib/types/segment';

interface SegmentsTableProps {
  segments: Segment[];
  isLoading?: boolean;
  deletingId?: string | null;
  onEdit: (segment: Segment) => void;
  onDelete: (segment: Segment) => void;
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, idx) => (
        <TableRow key={idx}>
          <TableCell>
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-14" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-56" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-24" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function formatDate(value?: string): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function renderFilterSummary(segment: Segment) {
  const tags = segment.filters.tags;
  const status = segment.filters.status;

  if (segment.contactIds.length > 0 && tags.length === 0 && status.length === 0) {
    return (
      <span className="text-xs text-zinc-300">
        {segment.contactIds.length} selected contact{segment.contactIds.length === 1 ? '' : 's'}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.length === 0 && status.length === 0 ? (
        <span className="text-xs text-zinc-500">No filters</span>
      ) : (
        <>
          {tags.map((tag) => (
            <span
              key={`tag-${tag}`}
              className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-300"
            >
              tag:{tag}
            </span>
          ))}
          {status.map((item) => (
            <span
              key={`status-${item}`}
              className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-300"
            >
              status:{item}
            </span>
          ))}
        </>
      )}
    </div>
  );
}

export function SegmentsTable({
  segments,
  isLoading = false,
  deletingId,
  onEdit,
  onDelete,
}: SegmentsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Filters</TableHead>
          <TableHead>Contacts</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <LoadingRows />
        ) : segments.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-14 text-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-200">No segments found</p>
                <p className="text-xs text-zinc-500">
                  Create your first segment to target contacts with filters.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          segments.map((segment) => (
            <TableRow key={segment.id}>
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium text-zinc-100">{segment.name}</p>
                  {segment.description && (
                    <p className="line-clamp-1 text-xs text-zinc-500">
                      {segment.description}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={segment.type === 'dynamic' ? 'warning' : 'neutral'}>
                  {segment.type}
                </Badge>
              </TableCell>
              <TableCell>{renderFilterSummary(segment)}</TableCell>
              <TableCell className="text-zinc-200">{segment.estimatedCount}</TableCell>
              <TableCell className="text-xs text-zinc-500">
                {formatDate(segment.updatedAt)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    onClick={() => onEdit(segment)}
                  >
                    <Edit3 className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(segment)}
                    disabled={deletingId === segment.id}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {deletingId === segment.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
