import { Edit3, Trash2 } from 'lucide-react';
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
import { SubscriptionStatusBadge } from '@/components/contacts/subscription-status-badge';
import type { Contact } from '@/lib/types/contact';

export interface ContactsTableColumn {
  id: string;
  label: string;
  type: 'static' | 'custom';
  customFieldKey?: string;
}

export const CONTACTS_TABLE_BASE_COLUMNS: ContactsTableColumn[] = [
  { id: 'name', label: 'Name', type: 'static' },
  { id: 'email', label: 'Email', type: 'static' },
  { id: 'phone', label: 'Phone', type: 'static' },
  { id: 'company', label: 'Company', type: 'static' },
  { id: 'status', label: 'Status', type: 'static' },
  { id: 'category', label: 'Category', type: 'static' },
  { id: 'labels', label: 'Labels', type: 'static' },
];

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (Array.isArray(value)) {
    const normalized = value.map((item) => String(item)).filter((item) => item.trim().length > 0);
    return normalized.length > 0 ? normalized.join(', ') : '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

interface ContactsTableProps {
  contacts: Contact[];
  columns: ContactsTableColumn[];
  visibleColumnIds: string[];
  isLoading?: boolean;
  selectedIds: string[];
  deletingId?: string | null;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelect: (contactId: string, checked: boolean) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

function LoadingRows({ columnCount }: { columnCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, idx) => (
        <TableRow key={idx}>
          {Array.from({ length: columnCount }).map((_, columnIndex) => (
            <TableCell key={columnIndex}>
              <Skeleton className="h-4 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function getDisplayName(contact: Contact): string {
  if (contact.fullName && contact.fullName.trim().length > 0) {
    return contact.fullName;
  }

  const fromParts = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  if (fromParts.length > 0) {
    return fromParts;
  }

  return 'Unnamed Contact';
}

export function ContactsTable({
  contacts,
  columns,
  visibleColumnIds,
  isLoading = false,
  selectedIds,
  deletingId,
  onToggleSelectAll,
  onToggleSelect,
  onEdit,
  onDelete,
}: ContactsTableProps) {
  const isAllSelected = contacts.length > 0 && selectedIds.length === contacts.length;
  const visibleColumns = columns.filter((column) => visibleColumnIds.includes(column.id));
  const tableColumnCount = visibleColumns.length + 2;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
              checked={isAllSelected}
              onChange={(event) => onToggleSelectAll(event.target.checked)}
            />
          </TableHead>
          {visibleColumns.map((column) => (
            <TableHead key={column.id}>{column.label}</TableHead>
          ))}
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <LoadingRows columnCount={tableColumnCount} />
        ) : contacts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={tableColumnCount} className="py-14 text-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-200">No contacts found</p>
                <p className="text-xs text-zinc-500">
                  Try adjusting filters or add a new contact.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
                  checked={selectedIds.includes(contact.id)}
                  onChange={(event) => onToggleSelect(contact.id, event.target.checked)}
                />
              </TableCell>
              {visibleColumns.map((column) => {
                if (column.type === 'custom') {
                  const customValue = column.customFieldKey
                    ? contact.customFields?.[column.customFieldKey]
                    : undefined;
                  return (
                    <TableCell key={column.id} className="text-zinc-300">
                      {formatCellValue(customValue)}
                    </TableCell>
                  );
                }

                switch (column.id) {
                  case 'name':
                    return (
                      <TableCell key={column.id}>
                        <p className="font-medium text-zinc-100">{getDisplayName(contact)}</p>
                      </TableCell>
                    );
                  case 'email':
                    return (
                      <TableCell key={column.id} className="text-zinc-300">
                        {contact.email ?? '-'}
                      </TableCell>
                    );
                  case 'phone':
                    return (
                      <TableCell key={column.id} className="text-zinc-300">
                        {contact.phone ?? '-'}
                      </TableCell>
                    );
                  case 'company':
                    return (
                      <TableCell key={column.id} className="text-zinc-300">
                        {contact.company ?? '-'}
                      </TableCell>
                    );
                  case 'status':
                    return (
                      <TableCell key={column.id}>
                        <SubscriptionStatusBadge value={contact.subscriptionStatus} />
                      </TableCell>
                    );
                  case 'category':
                    return (
                      <TableCell key={column.id}>
                        <span className="text-xs text-zinc-300">{contact.category ?? '-'}</span>
                      </TableCell>
                    );
                  case 'labels':
                    return (
                      <TableCell key={column.id}>
                        <div className="flex flex-wrap gap-1">
                          {contact.labels.length === 0 ? (
                            <span className="text-xs text-zinc-500">No labels</span>
                          ) : (
                            contact.labels.slice(0, 3).map((label) => (
                              <span
                                key={label}
                                className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-300"
                              >
                                {label}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                    );
                  default:
                    return (
                      <TableCell key={column.id} className="text-zinc-300">
                        -
                      </TableCell>
                    );
                }
              })}
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    onClick={() => onEdit(contact)}
                  >
                    <Edit3 className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(contact)}
                    disabled={deletingId === contact.id}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {deletingId === contact.id ? 'Deleting...' : 'Delete'}
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

