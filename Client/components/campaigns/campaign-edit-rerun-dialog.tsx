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
import { createCampaign, startCampaign } from '@/lib/api/campaigns';
import { getContacts, getContactCategorySummary } from '@/lib/api/contacts';
import { getSenderAccounts } from '@/lib/api/sender-accounts';
import { getTemplates } from '@/lib/api/templates';
import { HttpClientError } from '@/lib/api/errors';
import type { Campaign, CampaignBuilderValues } from '@/lib/types/campaign';
import type { Contact } from '@/lib/types/contact';
import type { ContactCategorySummaryItem } from '@/lib/types/contact';
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-rose-500">{message}</p>;
}

export function CampaignEditRerunDialog({ open, campaign, onOpenChange, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [categories, setCategories] = useState<ContactCategorySummaryItem[]>([]);
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
      name: `${campaign.name} (re-run)`,
      description: '',
      channel: campaign.channel,
      targetMode: 'contacts',
      segmentId: '',
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
  const watchedTemplateId = useWatch({ control: form.control, name: 'templateId' }) ?? '';
  const watchedCategoryName = useWatch({ control: form.control, name: 'categoryName' }) ?? '';
  const watchedSenderIds = useWatch({ control: form.control, name: 'senderAccountIds' }) ?? [];

  const loadOptions = useCallback(
    async (ch: 'email' | 'whatsapp') => {
      setIsLoading(true);
      const [contactsRes, sendersRes, templatesRes, categoriesRes] = await Promise.allSettled([
        getContacts({ page: 1, limit: 100 }),
        getSenderAccounts(ch),
        getTemplates({ page: 1, limit: 100, type: ch }),
        getContactCategorySummary(),
      ]);
      if (contactsRes.status === 'fulfilled') setContacts(contactsRes.value.items);
      if (sendersRes.status === 'fulfilled') setSenderAccounts(sendersRes.value);
      if (templatesRes.status === 'fulfilled') setTemplates(templatesRes.value.items);
      if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value.categories);
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

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      let resolvedContactIds = values.contactIds;

      // Resolve category → contact IDs at launch time
      if (values.targetMode === 'category' && values.categoryName) {
        const result = await getContacts({ category: values.categoryName, page: 1, limit: 100 });
        resolvedContactIds = result.items.map((c) => c.id);
        if (resolvedContactIds.length === 0) {
          toast.error(`No contacts found in category "${values.categoryName}".`);
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        ...values,
        contactIds: resolvedContactIds,
        targetMode: values.targetMode === 'category' ? 'contacts' : values.targetMode,
      } as CampaignBuilderValues;

      const created = await createCampaign(payload);
      await startCampaign(created.id);

      toast.success(`Campaign "${created.name}" launched successfully.`);
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit &amp; Re-run Campaign</DialogTitle>
          <DialogDescription>
            Modify the audience, template, and settings below. A new campaign will be created and
            launched immediately.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Campaign name */}
          <div className="space-y-1.5">
            <Label htmlFor="er-name">Campaign Name</Label>
            <Input id="er-name" placeholder="My Campaign (re-run)" {...form.register('name')} />
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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-lg border-2 p-3 text-left text-sm font-semibold transition-all ${
                  targetMode === 'contacts'
                    ? 'border-zinc-900 bg-zinc-100 text-black'
                    : 'border-zinc-400 bg-white text-black hover:bg-zinc-200'
                }`}
                onClick={() => {
                  form.setValue('targetMode', 'contacts');
                  form.setValue('categoryName', '');
                }}
              >
                Select Contacts
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
                  form.setValue('contactIds', []);
                }}
              >
                By Category
              </button>
            </div>

            {isLoading ? (
              <p className="text-xs text-zinc-400">Loading options...</p>
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
                  All contacts in the selected category will be included when launched.
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
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Launching...' : 'Re-run Campaign'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
