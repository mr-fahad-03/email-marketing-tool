'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateCampaign, startCampaign } from '@/lib/api/campaigns';
import { getAllContacts, getContacts, getContactCategorySummary } from '@/lib/api/contacts';
import { getSegments } from '@/lib/api/segments';
import { getSenderAccounts } from '@/lib/api/sender-accounts';
import { getTemplates } from '@/lib/api/templates';
import { HttpClientError } from '@/lib/api/errors';
import type { Campaign, CampaignBuilderValues } from '@/lib/types/campaign';
import type { Contact } from '@/lib/types/contact';
import type { ContactCategorySummaryItem } from '@/lib/types/contact';
import type { Segment } from '@/lib/types/segment';
import type { SenderAccount } from '@/lib/types/sender-account';
import type { MarketingTemplate } from '@/lib/types/template';
import {
  campaignBuilderSchema,
  type CampaignBuilderFormValues,
} from '@/lib/validators/campaign';

interface Props {
  open: boolean;
  campaign: Campaign | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function getContactLabel(contact: Contact): string {
  if (contact.fullName?.trim()) return contact.fullName;
  const fromParts = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  if (fromParts.length > 0) return fromParts;
  return contact.email ?? contact.phone ?? 'Contact';
}

function toggleId(ids: string[], id: string, checked: boolean): string[] {
  if (checked) return Array.from(new Set([...ids, id]));
  return ids.filter((item) => item !== id);
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((item, index) => item === rightSorted[index]);
}

function normalizeOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getCampaignComparable(campaign: Campaign) {
  return {
    name: campaign.name.trim(),
    channel: campaign.channel,
    senderAccountIds: campaign.senderAccountIds,
    segmentId: campaign.segmentId ?? undefined,
    contactIds: campaign.segmentId ? [] : campaign.contactIds,
    templateId: campaign.templateId ?? undefined,
    timezone: campaign.timezone ?? 'UTC',
    sendingWindowStart: normalizeOptionalString(campaign.sendingWindowStart),
    sendingWindowEnd: normalizeOptionalString(campaign.sendingWindowEnd),
    dailyCap: campaign.dailyCap ?? undefined,
  };
}

function getValuesComparable(values: CampaignBuilderValues) {
  return {
    name: values.name.trim(),
    channel: values.channel,
    senderAccountIds: values.senderAccountIds,
    segmentId: values.targetMode === 'segment' ? values.segmentId : undefined,
    contactIds: values.targetMode === 'contacts' ? values.contactIds : [],
    templateId: values.templateId,
    timezone: values.timezone,
    sendingWindowStart: normalizeOptionalString(values.sendingWindowStart),
    sendingWindowEnd: normalizeOptionalString(values.sendingWindowEnd),
    dailyCap: values.dailyCap,
  };
}

function hasCampaignChanges(campaign: Campaign, values: CampaignBuilderValues): boolean {
  const current = getCampaignComparable(campaign);
  const next = getValuesComparable(values);

  return (
    current.name !== next.name ||
    current.channel !== next.channel ||
    !sameStringArray(current.senderAccountIds, next.senderAccountIds) ||
    current.segmentId !== next.segmentId ||
    !sameStringArray(current.contactIds, next.contactIds) ||
    current.templateId !== next.templateId ||
    current.timezone !== next.timezone ||
    current.sendingWindowStart !== next.sendingWindowStart ||
    current.sendingWindowEnd !== next.sendingWindowEnd ||
    current.dailyCap !== next.dailyCap
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-rose-500">{message}</p>;
}

export function CampaignEditRerunDialog({ open, campaign, onOpenChange, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [categories, setCategories] = useState<ContactCategorySummaryItem[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [senderAccounts, setSenderAccounts] = useState<SenderAccount[]>([]);
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CampaignBuilderFormValues>({
    resolver: zodResolver(campaignBuilderSchema) as never,
    defaultValues: {
      name: '',
      description: '',
      channel: 'email',
      targetMode: 'contacts',
      segmentId: '',
      categoryName: '',
      contactIds: [],
      senderAccountIds: [],
      templateId: '',
      scheduleMode: 'now',
      timezone: 'UTC',
      startAt: '',
      sendingWindowStart: '',
      sendingWindowEnd: '',
      dailyCap: undefined,
    },
  });

  // Pre-fill form when campaign changes
  useEffect(() => {
    if (!campaign || !open) return;
    form.reset({
      name: campaign.name,
      description: '',
      channel: campaign.channel,
      targetMode: campaign.segmentId ? 'segment' : 'contacts',
      segmentId: campaign.segmentId ?? '',
      categoryName: '',
      contactIds: campaign.contactIds,
      senderAccountIds: campaign.senderAccountIds,
      templateId: campaign.templateId ?? '',
      scheduleMode: 'now',
      timezone: campaign.timezone ?? 'UTC',
      startAt: '',
      sendingWindowStart: campaign.sendingWindowStart ?? '',
      sendingWindowEnd: campaign.sendingWindowEnd ?? '',
      dailyCap: campaign.dailyCap ?? undefined,
    });
  }, [campaign, form, open]);

  const channel = useWatch({ control: form.control, name: 'channel' }) ?? 'email';
  const targetMode = useWatch({ control: form.control, name: 'targetMode' }) ?? 'contacts';
  const watchedContactIds = useWatch({ control: form.control, name: 'contactIds' }) ?? [];
  const watchedSegmentId = useWatch({ control: form.control, name: 'segmentId' }) ?? '';
  const watchedTemplateId = useWatch({ control: form.control, name: 'templateId' }) ?? '';
  const watchedCategoryName = useWatch({ control: form.control, name: 'categoryName' }) ?? '';
  const watchedSenderIds = useWatch({ control: form.control, name: 'senderAccountIds' }) ?? [];

  const loadOptions = useCallback(
    async (ch: 'email' | 'whatsapp') => {
      setIsLoading(true);
      const [contactsRes, sendersRes, templatesRes, categoriesRes, segmentsRes] =
        await Promise.allSettled([
          getContacts({ page: 1, limit: 100 }),
          getSenderAccounts(ch),
          getTemplates({ page: 1, limit: 100, type: ch }),
          getContactCategorySummary(),
          getSegments({ page: 1, limit: 100 }),
        ]);
      if (contactsRes.status === 'fulfilled') setContacts(contactsRes.value.items);
      if (sendersRes.status === 'fulfilled') setSenderAccounts(sendersRes.value);
      if (templatesRes.status === 'fulfilled') setTemplates(templatesRes.value.items);
      if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value.categories);
      if (segmentsRes.status === 'fulfilled') setSegments(segmentsRes.value.items);
      setIsLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (open) void loadOptions(channel as 'email' | 'whatsapp');
  }, [open, channel, loadOptions]);

  // Filtered templates (always latest version by ID)
  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.type === channel),
    [templates, channel],
  );

  const handleSaveAndOrLaunch = async (shouldLaunch: boolean) => {
    if (!campaign) return;

    const isValid = await form.trigger();
    if (!isValid) return;

    const values = form.getValues();

    if (shouldLaunch) {
      setIsLaunching(true);
    } else {
      setIsSubmitting(true);
    }

    try {
      let resolvedContactIds = values.contactIds;

      if (values.targetMode === 'category' && values.categoryName) {
        const categoryContacts = await getAllContacts({ category: values.categoryName });
        resolvedContactIds = categoryContacts.map((contact) => contact.id);
        if (resolvedContactIds.length === 0) {
          toast.error(`No contacts found in category "${values.categoryName}".`);
          return;
        }
      }

      const payload = {
        ...values,
        contactIds: resolvedContactIds,
        targetMode: values.targetMode === 'category' ? 'contacts' : values.targetMode,
        dailyCap: values.dailyCap ? Number(values.dailyCap) : undefined,
      } as CampaignBuilderValues;

      if (!shouldLaunch && !hasCampaignChanges(campaign, payload)) {
        toast.info('No changes to save.');
        onOpenChange(false);
        return;
      }

      const updated = await updateCampaign(campaign.id, payload);

      if (shouldLaunch) {
        await startCampaign(campaign.id);
        toast.success(`Campaign "${updated.name}" launched successfully!`);
      } else {
        toast.success(`Campaign "${updated.name}" updated successfully.`);
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign Segment</DialogTitle>
          <DialogDescription>
            Modify the audience, template, and settings below. The existing campaign segment will
            be updated.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          {/* Campaign name */}
          <div className="space-y-1.5">
            <Label htmlFor="er-name">Campaign Name</Label>
            <Input id="er-name" placeholder="My Campaign" {...form.register('name')} />
            <FieldError message={form.formState.errors.name?.message} />
          </div>

          {/* Channel */}
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-lg border-2 p-3 text-left text-sm font-semibold transition-all ${
                  channel === 'email'
                    ? 'border-zinc-900 bg-zinc-100 text-black'
                    : 'border-zinc-400 bg-white text-black hover:bg-zinc-200'
                }`}
                onClick={() => {
                  form.setValue('channel', 'email');
                  form.setValue('senderAccountIds', []);
                  form.setValue('templateId', '');
                }}
              >
                Email
              </button>
              <button
                type="button"
                className={`rounded-lg border-2 p-3 text-left text-sm font-semibold transition-all ${
                  channel === 'whatsapp'
                    ? 'border-zinc-900 bg-zinc-100 text-black'
                    : 'border-zinc-400 bg-white text-black hover:bg-zinc-200'
                }`}
                onClick={() => {
                  form.setValue('channel', 'whatsapp');
                  form.setValue('senderAccountIds', []);
                  form.setValue('templateId', '');
                }}
              >
                WhatsApp
              </button>
            </div>
          </div>

          {/* Audience Mode */}
          <div className="space-y-2">
            <Label>Audience</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className={`rounded-lg border-2 p-3 text-left text-sm font-semibold transition-all ${
                  targetMode === 'segment'
                    ? 'border-zinc-900 bg-zinc-100 text-black'
                    : 'border-zinc-400 bg-white text-black hover:bg-zinc-200'
                }`}
                onClick={() => {
                  form.setValue('targetMode', 'segment');
                  form.setValue('categoryName', '');
                  form.setValue('contactIds', []);
                }}
              >
                Segment
              </button>
              <button
                type="button"
                className={`rounded-lg border-2 p-3 text-left text-sm font-semibold transition-all ${
                  targetMode === 'contacts'
                    ? 'border-zinc-900 bg-zinc-100 text-black'
                    : 'border-zinc-400 bg-white text-black hover:bg-zinc-200'
                }`}
                onClick={() => {
                  form.setValue('targetMode', 'contacts');
                  form.setValue('segmentId', '');
                  form.setValue('categoryName', '');
                }}
              >
                Contacts
              </button>
              <button
                type="button"
                className={`rounded-lg border-2 p-3 text-left text-sm font-semibold transition-all ${
                  targetMode === 'category'
                    ? 'border-zinc-900 bg-zinc-100 text-black'
                    : 'border-zinc-400 bg-white text-black hover:bg-zinc-200'
                }`}
                onClick={() => {
                  form.setValue('targetMode', 'category');
                  form.setValue('segmentId', '');
                  form.setValue('contactIds', []);
                }}
              >
                Category
              </button>
            </div>

            {isLoading ? (
              <p className="text-xs text-zinc-400">Loading options...</p>
            ) : targetMode === 'segment' ? (
              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                {segments.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-zinc-400">No segments found.</p>
                ) : (
                  segments.map((segment) => (
                    <label
                      key={segment.id}
                      className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-100 px-3 py-2 hover:bg-zinc-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-800">{segment.name}</p>
                        <p className="text-xs text-zinc-400">
                          {segment.estimatedCount} contact
                          {segment.estimatedCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <input
                        type="radio"
                        className="h-4 w-4 accent-zinc-900"
                        checked={watchedSegmentId === segment.id}
                        onChange={() =>
                          form.setValue('segmentId', segment.id, { shouldDirty: true })
                        }
                      />
                    </label>
                  ))
                )}
              </div>
            ) : targetMode === 'contacts' ? (
              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                {contacts.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-zinc-400">No contacts found.</p>
                ) : (
                  contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-100 px-3 py-2 hover:bg-zinc-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-800">
                          {getContactLabel(contact)}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {contact.email ?? contact.phone ?? '-'}
                          {contact.category && (
                            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                              {contact.category}
                            </span>
                          )}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-zinc-900"
                        checked={watchedContactIds.includes(contact.id)}
                        onChange={(e) =>
                          form.setValue(
                            'contactIds',
                            toggleId(watchedContactIds, contact.id, e.target.checked),
                            { shouldDirty: true },
                          )
                        }
                      />
                    </label>
                  ))
                )}
                {watchedContactIds.length > 0 && (
                  <p className="pt-1 text-right text-xs text-zinc-500">
                    {watchedContactIds.length} selected
                  </p>
                )}
              </div>
            ) : (
              /* By Category */
              <div className="space-y-1.5">
                <p className="text-xs text-zinc-400">
                  All contacts in the selected category will be saved as the audience.
                </p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                  {categories.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-zinc-400">No categories found.</p>
                  ) : (
                    categories.map((item) => (
                      <label
                        key={item.category}
                        className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-100 px-3 py-2 hover:bg-zinc-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-800">{item.category}</p>
                          <p className="text-xs text-zinc-400">
                            {item.count} contact{item.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <input
                          type="radio"
                          className="h-4 w-4 accent-zinc-900"
                          checked={watchedCategoryName === item.category}
                          onChange={() =>
                            form.setValue('categoryName', item.category, { shouldDirty: true })
                          }
                        />
                      </label>
                    ))
                  )}
                </div>
                <FieldError message={form.formState.errors.categoryName?.message} />
              </div>
            )}

            {targetMode === 'segment' && (
              <FieldError message={form.formState.errors.segmentId?.message} />
            )}
            {targetMode === 'contacts' && (
              <FieldError
                message={form.formState.errors.contactIds?.message as string | undefined}
              />
            )}
          </div>

          {/* Sender Accounts */}
          <div className="space-y-2">
            <Label>Sender Accounts</Label>
            {isLoading ? (
              <p className="text-xs text-zinc-400">Loading...</p>
            ) : senderAccounts.length === 0 ? (
              <p className="text-xs text-zinc-400">No sender accounts for this channel.</p>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                {senderAccounts.map((sender) => (
                  <label
                    key={sender.id}
                    className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-100 px-3 py-2 hover:bg-zinc-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{sender.name}</p>
                      <p className="text-xs text-zinc-400">
                        {sender.type === 'email' ? sender.email : sender.phoneNumber}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-zinc-900"
                      checked={watchedSenderIds.includes(sender.id)}
                      onChange={(e) =>
                        form.setValue(
                          'senderAccountIds',
                          toggleId(watchedSenderIds, sender.id, e.target.checked),
                          { shouldDirty: true },
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            <FieldError
              message={form.formState.errors.senderAccountIds?.message as string | undefined}
            />
          </div>

          {/* Template — always fetched at latest version */}
          <div className="space-y-2">
            <Label>Template</Label>
            <p className="text-xs text-zinc-400">
              Templates are always loaded at their latest version — any edits you&apos;ve made are
              reflected here automatically.
            </p>
            {isLoading ? (
              <p className="text-xs text-zinc-400">Loading templates...</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="text-xs text-zinc-400">No templates for this channel.</p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                {filteredTemplates.map((tpl) => {
                  const isSelected = watchedTemplateId === tpl.id;
                  return (
                    <label
                      key={tpl.id}
                      className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 transition-colors ${
                        isSelected
                          ? 'border-zinc-900 bg-zinc-50'
                          : 'border-zinc-100 hover:bg-zinc-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-800">{tpl.name}</p>
                        <p className="line-clamp-1 text-xs text-zinc-400">{tpl.subject}</p>
                        {isSelected && (
                          <Badge variant="neutral" className="mt-1 text-[10px]">
                            Selected (latest version)
                          </Badge>
                        )}
                      </div>
                      <input
                        type="radio"
                        className="h-4 w-4 accent-zinc-900"
                        checked={isSelected}
                        onChange={() =>
                          form.setValue('templateId', tpl.id, { shouldDirty: true })
                        }
                      />
                    </label>
                  );
                })}
              </div>
            )}
            <FieldError message={form.formState.errors.templateId?.message} />
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input
              placeholder="UTC"
              {...form.register('timezone')}
            />
            <FieldError message={form.formState.errors.timezone?.message} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isLaunching}
            >
              Cancel
            </Button>
            {campaign?.status === 'draft' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSaveAndOrLaunch(false)}
                  disabled={isSubmitting || isLaunching || isLoading}
                >
                  {isSubmitting ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  type="button"
                  className="bg-black text-white hover:bg-zinc-800"
                  onClick={() => void handleSaveAndOrLaunch(true)}
                  disabled={isSubmitting || isLaunching || isLoading}
                >
                  {isLaunching ? 'Launching...' : 'Save & Launch'}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => void handleSaveAndOrLaunch(false)}
                disabled={isSubmitting || isLaunching || isLoading}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
