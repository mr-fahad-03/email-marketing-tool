'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SegmentFilterPreview } from '@/components/segments/segment-filter-preview';
import { Button } from '@/components/ui/button';
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
import { getContacts } from '@/lib/api/contacts';
import type { Contact } from '@/lib/types/contact';
import type { Segment } from '@/lib/types/segment';
import { segmentFormSchema, type SegmentFormValues } from '@/lib/validators/segment';

const STATUS_OPTIONS = ['subscribed', 'pending', 'unsubscribed', 'suppressed'] as const;

interface SegmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment?: Segment | null;
  isSubmitting?: boolean;
  onSubmit: (values: SegmentFormValues) => Promise<void>;
}

function getDefaultValues(segment?: Segment | null): SegmentFormValues {
  return {
    name: segment?.name ?? '',
    description: segment?.description ?? '',
    type: segment?.type ?? 'static',
    audienceMode:
      segment?.type === 'static' && (segment.contactIds?.length ?? 0) > 0 ? 'contacts' : 'filters',
    filterTags: segment?.filters.tags ?? [],
    filterStatus: segment?.filters.status ?? [],
    contactIds: segment?.contactIds ?? [],
  };
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-rose-400">{message}</p>;
}

export function SegmentFormDialog({
  open,
  onOpenChange,
  segment,
  isSubmitting = false,
  onSubmit,
}: SegmentFormDialogProps) {
  const isEdit = Boolean(segment);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  const form = useForm<SegmentFormValues>({
    resolver: zodResolver(segmentFormSchema) as never,
    defaultValues: getDefaultValues(segment),
  });

  useEffect(() => {
    form.reset(getDefaultValues(segment));
  }, [form, open, segment]);

  const watchedTags = useWatch({
    control: form.control,
    name: 'filterTags',
  }) ?? [];

  const watchedStatus = useWatch({
    control: form.control,
    name: 'filterStatus',
  }) ?? [];

  const watchedType = useWatch({
    control: form.control,
    name: 'type',
  }) ?? 'static';

  const watchedAudienceMode = useWatch({
    control: form.control,
    name: 'audienceMode',
  }) ?? 'filters';

  const watchedContactIds = useWatch({
    control: form.control,
    name: 'contactIds',
  }) ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;

    const loadContacts = async () => {
      setIsLoadingContacts(true);

      try {
        const response = await getContacts({ page: 1, limit: 100 });
        if (isMounted) {
          setContacts(response.items);
        }
      } finally {
        if (isMounted) {
          setIsLoadingContacts(false);
        }
      }
    };

    void loadContacts();

    return () => {
      isMounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (watchedType === 'dynamic') {
      form.setValue('audienceMode', 'filters');
      form.setValue('contactIds', []);
    }
  }, [form, watchedType]);

  const handleToggleStatus = (status: string, checked: boolean) => {
    const current = form.getValues('filterStatus') ?? [];

    if (checked) {
      form.setValue('filterStatus', Array.from(new Set([...current, status])), {
        shouldDirty: true,
      });
      return;
    }

    form.setValue(
      'filterStatus',
      current.filter((item) => item !== status),
      {
        shouldDirty: true,
      },
    );
  };

  const handleToggleContact = (contactId: string, checked: boolean) => {
    const current = form.getValues('contactIds') ?? [];

    if (checked) {
      form.setValue('contactIds', Array.from(new Set([...current, contactId])), {
        shouldDirty: true,
      });
      return;
    }

    form.setValue(
      'contactIds',
      current.filter((item) => item !== contactId),
      {
        shouldDirty: true,
      },
    );
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Segment' : 'Create Segment'}</DialogTitle>
          <DialogDescription>
            Build reusable segments with either filters or directly selected contacts.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Segment Name</Label>
              <Input
                id="name"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="High Intent Leads"
                {...form.register('name')}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={3}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="Users tagged vip and currently subscribed."
                {...form.register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                {...form.register('type')}
              >
                <option value="static">Static</option>
                <option value="dynamic">Dynamic</option>
              </select>
            </div>

            {watchedType === 'static' && (
              <div className="space-y-2">
                <Label htmlFor="audienceMode">Audience Source</Label>
                <select
                  id="audienceMode"
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                  {...form.register('audienceMode')}
                >
                  <option value="filters">Use Filters</option>
                  <option value="contacts">Select Contacts</option>
                </select>
              </div>
            )}

            {watchedType === 'dynamic' || watchedAudienceMode === 'filters' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="filterTags">Filter Tags</Label>
                  <Input
                    id="filterTags"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    placeholder="vip, trial, newsletter"
                    value={watchedTags.join(', ')}
                    onChange={(event) => {
                      form.setValue('filterTags', parseTags(event.target.value), {
                        shouldDirty: true,
                      });
                    }}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Status Filters</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {STATUS_OPTIONS.map((status) => (
                      <label
                        key={status}
                        className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
                          checked={watchedStatus.includes(status)}
                          onChange={(event) => handleToggleStatus(status, event.target.checked)}
                        />
                        {status}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <Label>Select Contacts</Label>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-zinc-800 p-2">
                  {isLoadingContacts ? (
                    <p className="px-2 py-3 text-sm text-zinc-500">Loading contacts...</p>
                  ) : contacts.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-zinc-500">No contacts found.</p>
                  ) : (
                    contacts.map((contact) => {
                      const label =
                        contact.fullName ||
                        [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() ||
                        contact.email ||
                        contact.phone ||
                        'Contact';

                      return (
                        <label
                          key={contact.id}
                          className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-zinc-100">{label}</p>
                            <p className="text-xs text-zinc-500">
                              {contact.email ?? contact.phone ?? '-'}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={watchedContactIds.includes(contact.id)}
                            onChange={(event) => handleToggleContact(contact.id, event.target.checked)}
                          />
                        </label>
                      );
                    })
                  )}
                </div>
                <FieldError message={form.formState.errors.contactIds?.message as string | undefined} />
              </div>
            )}
          </div>

          <SegmentFilterPreview
            values={{
              type: watchedType,
              audienceMode: watchedAudienceMode,
              filterTags: watchedTags,
              filterStatus: watchedStatus,
              contactIds: watchedContactIds,
            }}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Segment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
