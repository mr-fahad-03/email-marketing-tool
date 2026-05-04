'use client';

import { Columns3, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ContactFormDialog } from '@/components/contacts/contact-form-dialog';
import {
  ContactsFilters,
  type ContactsFilterState,
} from '@/components/contacts/contacts-filters';
import {
  CONTACTS_TABLE_BASE_COLUMNS,
  ContactsTable,
  type ContactsTableColumn,
} from '@/components/contacts/contacts-table';
import { CsvImportCard } from '@/components/contacts/csv-import-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HttpClientError } from '@/lib/api/errors';
import {
  bulkDeleteContacts,
  bulkSetCategoryToContacts,
  createContactCategory,
  createContact,
  deleteContact,
  getContactCategorySummary,
  getContacts,
  importContacts,
  updateContact,
} from '@/lib/api/contacts';
import type {
  Contact,
  ContactCategorySummaryItem,
  ContactsPagination,
} from '@/lib/types/contact';
import type { ContactFormValues } from '@/lib/validators/contact';

const DEFAULT_PAGINATION: ContactsPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
};

const DEFAULT_FILTERS: ContactsFilterState = {
  search: '',
  status: '',
  category: '',
};

const COLUMN_VISIBILITY_STORAGE_KEY = 'contacts-table-column-visibility.v1';

const CUSTOM_FIELD_LABEL_OVERRIDES: Record<string, string> = {
  country: 'Country',
  city: 'City',
  telephone: 'Telephone',
  mobile: 'Mobile',
  additionalNumber: 'Additional Number',
  designation: 'Designation',
  department: 'Department',
  leadSource: 'Lead Source',
};

const PREFERRED_CUSTOM_FIELD_ORDER = [
  'country',
  'city',
  'telephone',
  'mobile',
  'additionalNumber',
  'designation',
  'department',
  'leadSource',
];

function formatColumnLabelFromKey(fieldKey: string): string {
  const formatted = fieldKey
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!formatted) {
    return fieldKey;
  }

  return formatted
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<ContactsPagination>(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [filters, setFilters] = useState<ContactsFilterState>(DEFAULT_FILTERS);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetCategory, setBulkTargetCategory] = useState('');
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isAllCategoriesModalOpen, setIsAllCategoriesModalOpen] = useState(false);
  const [isCategorySummaryLoading, setIsCategorySummaryLoading] = useState(false);
  const [categorySummary, setCategorySummary] = useState<ContactCategorySummaryItem[]>([]);
  const [totalContactsCount, setTotalContactsCount] = useState(0);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [createdCategories, setCreatedCategories] = useState<string[]>([]);
  const [applyCategoryToSelected, setApplyCategoryToSelected] = useState(true);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [discoveredCustomFieldKeys, setDiscoveredCustomFieldKeys] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [hasHydratedColumnVisibility, setHasHydratedColumnVisibility] = useState(false);

  useEffect(() => {
    const fieldKeys = new Set<string>();

    contacts.forEach((contact) => {
      const customFields = contact.customFields;
      if (!customFields) {
        return;
      }

      Object.keys(customFields).forEach((key) => {
        const normalizedKey = key.trim();
        if (normalizedKey.length > 0) {
          fieldKeys.add(normalizedKey);
        }
      });
    });

    setDiscoveredCustomFieldKeys((prev) => {
      const next = new Set(prev);
      fieldKeys.forEach((key) => next.add(key));
      return Array.from(next);
    });
  }, [contacts]);

  const customFieldColumns = useMemo<ContactsTableColumn[]>(() => {
    const keyEntries = [...discoveredCustomFieldKeys];
    keyEntries.sort((a, b) => {
      const preferredA = PREFERRED_CUSTOM_FIELD_ORDER.indexOf(a);
      const preferredB = PREFERRED_CUSTOM_FIELD_ORDER.indexOf(b);

      if (preferredA !== -1 || preferredB !== -1) {
        if (preferredA === -1) {
          return 1;
        }
        if (preferredB === -1) {
          return -1;
        }
        return preferredA - preferredB;
      }

      return a.localeCompare(b);
    });

    return keyEntries.map((fieldKey) => ({
      id: `custom:${fieldKey}`,
      label: CUSTOM_FIELD_LABEL_OVERRIDES[fieldKey] ?? formatColumnLabelFromKey(fieldKey),
      type: 'custom',
      customFieldKey: fieldKey,
    }));
  }, [discoveredCustomFieldKeys]);

  const tableColumns = useMemo<ContactsTableColumn[]>(
    () => [...CONTACTS_TABLE_BASE_COLUMNS, ...customFieldColumns],
    [customFieldColumns],
  );

  const visibleColumnIds = useMemo(
    () => tableColumns.filter((column) => columnVisibility[column.id] !== false).map((column) => column.id),
    [columnVisibility, tableColumns],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      setHasHydratedColumnVisibility(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return;
      }

      const normalized = Object.entries(parsed as Record<string, unknown>).reduce<Record<string, boolean>>(
        (acc, [key, value]) => {
          if (typeof value === 'boolean') {
            acc[key] = value;
          }
          return acc;
        },
        {},
      );

      setColumnVisibility(normalized);
    } catch {
      // ignore malformed persisted data
    } finally {
      setHasHydratedColumnVisibility(true);
    }
  }, []);

  useEffect(() => {
    setColumnVisibility((prev) => {
      const next = { ...prev };
      let changed = false;

      tableColumns.forEach((column) => {
        if (!(column.id in next)) {
          next[column.id] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [tableColumns]);

  useEffect(() => {
    if (!hasHydratedColumnVisibility || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility, hasHydratedColumnVisibility]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [filters]);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await getContacts({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search.trim() || undefined,
        status: filters.status || undefined,
        category: filters.category || undefined,
      });

      setContacts(response.items);
      setPagination(response.pagination);
      setSelectedIds([]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.limit, pagination.page]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const loadCategorySummary = useCallback(async () => {
    setIsCategorySummaryLoading(true);

    try {
      const response = await getContactCategorySummary();
      setCategorySummary(response.categories);
      setTotalContactsCount(response.total);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsCategorySummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategorySummary();
  }, [loadCategorySummary]);

  useEffect(() => {
    if (!isAllCategoriesModalOpen) {
      return;
    }

    void loadCategorySummary();
  }, [isAllCategoriesModalOpen, loadCategorySummary]);

  const handleFilterChange = (patch: Partial<ContactsFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleToggleColumnVisibility = (columnId: string, checked: boolean | 'indeterminate') => {
    const shouldShow = checked === true;

    setColumnVisibility((prev) => {
      const currentlyVisibleCount = tableColumns.reduce((count, column) => {
        const isVisible = prev[column.id] !== false;
        return isVisible ? count + 1 : count;
      }, 0);

      const isCurrentlyVisible = prev[columnId] !== false;
      if (!shouldShow && isCurrentlyVisible && currentlyVisibleCount <= 1) {
        toast.error('At least one column must remain visible.');
        return prev;
      }

      return {
        ...prev,
        [columnId]: shouldShow,
      };
    });
  };

  const openCreate = () => {
    setEditingContact(null);
    setIsFormOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const closeForm = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingContact(null);
    }
  };

  const handleSave = async (values: ContactFormValues) => {
    setIsSaving(true);

    try {
      if (editingContact) {
        await updateContact(editingContact.id, values);
        toast.success('Contact updated.');
      } else {
        await createContact(values);
        toast.success('Contact created.');
      }

      closeForm(false);
      await Promise.all([loadContacts(), loadCategorySummary()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (contact: Contact) => {
    const confirmed = window.confirm(`Delete "${contact.fullName || contact.email || contact.phone || 'contact'}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(contact.id);

    try {
      await deleteContact(contact.id);
      toast.success('Contact deleted.');
      await Promise.all([loadContacts(), loadCategorySummary()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);

    try {
      const result = await importContacts(file);
      toast.success(
        `${result.message ?? 'Import complete.'} Created: ${result.created}, Skipped: ${result.skipped}, Invalid: ${result.invalid}`,
      );
      await Promise.all([loadContacts(), loadCategorySummary()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(contacts.map((contact) => contact.id));
  };

  const handleToggleSelect = (contactId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, contactId])));
      return;
    }

    setSelectedIds((prev) => prev.filter((id) => id !== contactId));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected contacts?`);
    if (!confirmed) {
      return;
    }

    setIsBulkLoading(true);

    try {
      const result = await bulkDeleteContacts(selectedIds);
      toast.success(`Deleted ${result.deleted} of ${result.requested} selected contacts.`);
      await Promise.all([loadContacts(), loadCategorySummary()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkMoveCategory = async () => {
    const normalizedCategory = bulkTargetCategory.trim();
    if (!normalizedCategory || selectedIds.length === 0) {
      return;
    }

    setIsBulkLoading(true);

    try {
      const result = await bulkSetCategoryToContacts(selectedIds, normalizedCategory);
      toast.success(
        `Category moved for ${result.modified} of ${result.requested} selected contacts.`,
      );
      setBulkTargetCategory('');
      await Promise.all([loadContacts(), loadCategorySummary()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    const normalizedCategory = newCategoryInput.trim();
    if (!normalizedCategory) {
      return;
    }

    setIsCreatingCategory(true);

    try {
      const created = await createContactCategory(normalizedCategory);
      const savedCategory = created.category.trim();

      if (!savedCategory) {
        throw new Error('Failed to save category');
      }

      const shouldApplyToSelection = applyCategoryToSelected && selectedIds.length > 0;

      if (shouldApplyToSelection) {
        const result = await bulkSetCategoryToContacts(selectedIds, savedCategory);
        toast.success(
          `Category "${savedCategory}" assigned to ${result.modified} of ${result.requested} selected contacts.`,
        );
        await Promise.all([loadContacts(), loadCategorySummary()]);
      } else {
        toast.success(
          `Category "${savedCategory}" is ready. You can assign it while creating or editing contacts.`,
        );
      }

      setCreatedCategories((prev) => {
        const next = [...prev, savedCategory];
        return Array.from(new Set(next));
      });

      setBulkTargetCategory(savedCategory);

      setFilters((prev) => ({ ...prev, category: savedCategory }));
      setNewCategoryInput('');
      setIsCategoryDialogOpen(false);

      await loadCategorySummary();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const goToPreviousPage = () => {
    setPagination((prev) => ({
      ...prev,
      page: Math.max(1, prev.page - 1),
    }));
  };

  const goToNextPage = () => {
    setPagination((prev) => ({
      ...prev,
      page: Math.min(prev.totalPages || 1, prev.page + 1),
    }));
  };

  const categoryOptions = useMemo(() => {
    const options = [
      ...createdCategories,
      ...categorySummary.map((item) => item.category),
      ...contacts
      .map((contact) => contact.category?.trim())
      .filter((value): value is string => Boolean(value && value.length > 0)),
    ];

    if (editingContact?.category?.trim()) {
      options.push(editingContact.category.trim());
    }

    return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b));
  }, [categorySummary, contacts, createdCategories, editingContact]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Contacts</h2>
          <p className="text-sm text-zinc-400">
            Manage your audience list with filters, bulk actions, and imports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setIsAllCategoriesModalOpen(true)}>
            All Categories
          </Button>
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
            Add Category
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <CsvImportCard isImporting={isImporting} onImport={handleImport} />

      <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Filters</CardTitle>
          <ContactsFilters
            filters={filters}
            categoryOptions={categoryOptions}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
          />

          <div className="flex justify-start">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
                  <Columns3 className="mr-2 h-4 w-4" />
                  Columns ({visibleColumnIds.length}/{tableColumns.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[340px] w-64 overflow-y-auto">
                <DropdownMenuLabel>Toggle Table Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={columnVisibility[column.id] !== false}
                    onCheckedChange={(checked) => handleToggleColumnVisibility(column.id, checked)}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-400">
              {selectedIds.length} selected
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                value={bulkTargetCategory}
                onChange={(event) => setBulkTargetCategory(event.target.value)}
              >
                <option value="">Move to category</option>
                {categoryOptions.map((categoryOption) => (
                  <option key={categoryOption} value={categoryOption}>
                    {categoryOption}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                onClick={() => void handleBulkMoveCategory()}
                disabled={selectedIds.length === 0 || !bulkTargetCategory.trim() || isBulkLoading}
              >
                {isBulkLoading ? 'Applying...' : 'Move Category'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleBulkDelete()}
                disabled={selectedIds.length === 0 || isBulkLoading}
              >
                {isBulkLoading ? 'Processing...' : 'Delete Selected'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ContactsTable
            contacts={contacts}
            columns={tableColumns}
            visibleColumnIds={visibleColumnIds}
            isLoading={isLoading}
            selectedIds={selectedIds}
            deletingId={deletingId}
            onToggleSelectAll={handleToggleSelectAll}
            onToggleSelect={handleToggleSelect}
            onEdit={openEdit}
            onDelete={handleDelete}
          />

          <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              Page {pagination.page} of {pagination.totalPages} | {pagination.total} total contacts
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                onClick={goToPreviousPage}
                disabled={pagination.page <= 1 || isLoading}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                onClick={goToNextPage}
                disabled={pagination.page >= pagination.totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ContactFormDialog
        open={isFormOpen}
        onOpenChange={closeForm}
        contact={editingContact}
        categoryOptions={categoryOptions}
        onSubmit={handleSave}
        isSubmitting={isSaving}
      />

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a category and optionally assign it to currently selected contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="newCategory">Category Name</Label>
              <Input
                id="newCategory"
                value={newCategoryInput}
                placeholder="vip"
                onChange={(event) => setNewCategoryInput(event.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={applyCategoryToSelected && selectedIds.length > 0}
                onChange={(event) => setApplyCategoryToSelected(event.target.checked)}
                disabled={selectedIds.length === 0}
              />
              Apply to selected contacts ({selectedIds.length})
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCategoryDialogOpen(false)}
              disabled={isCreatingCategory}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateCategory()}
              disabled={!newCategoryInput.trim() || isCreatingCategory}
            >
              {isCreatingCategory ? 'Saving...' : 'Save Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAllCategoriesModalOpen} onOpenChange={setIsAllCategoriesModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>All Categories</DialogTitle>
            <DialogDescription>
              Select a category to filter contacts.
            </DialogDescription>
          </DialogHeader>

          {isCategorySummaryLoading ? (
            <p className="text-sm text-zinc-400">Loading categories...</p>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, category: '' }));
                  setIsAllCategoriesModalOpen(false);
                }}
              >
                <span>All Contacts</span>
                <span className="text-zinc-400">{totalContactsCount}</span>
              </button>

              {categorySummary.length === 0 ? (
                <p className="text-sm text-zinc-500">No categories available yet.</p>
              ) : (
                categorySummary.map((item) => (
                  <button
                    key={item.category}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, category: item.category }));
                      setIsAllCategoriesModalOpen(false);
                    }}
                  >
                    <span>{item.category}</span>
                    <span className="text-zinc-400">{item.count}</span>
                  </button>
                ))
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAllCategoriesModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
