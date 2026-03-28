'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { CampaignStepper, type CampaignStep } from '@/components/campaigns/campaign-stepper';
import { ContactFormDialog } from '@/components/contacts/contact-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCampaign, getCampaignContacts, getCampaigns, startCampaign } from '@/lib/api/campaigns';
import { bulkAddTagToContacts, updateContact } from '@/lib/api/contacts';
import { getContacts } from '@/lib/api/contacts';
import { getSegments } from '@/lib/api/segments';
import { getSenderAccounts } from '@/lib/api/sender-accounts';
import { getTemplates } from '@/lib/api/templates';
import { HttpClientError } from '@/lib/api/errors';
import type { Campaign, CampaignBuilderValues } from '@/lib/types/campaign';
import type { Contact, ContactsPagination } from '@/lib/types/contact';
import type { Segment } from '@/lib/types/segment';
import type { SenderAccount } from '@/lib/types/sender-account';
import type { MarketingTemplate } from '@/lib/types/template';
import type { ContactFormValues } from '@/lib/validators/contact';
import {
  campaignBuilderSchema,
  type CampaignBuilderFormValues,
} from '@/lib/validators/campaign';

const CAMPAIGN_STEPS: CampaignStep[] = [
  { id: 'details', label: 'Details' },
  { id: 'channel', label: 'Channel' },
  { id: 'audience', label: 'Audience' },
  { id: 'senders', label: 'Senders' },
  { id: 'template', label: 'Template' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'review', label: 'Review & Launch' },
];

const STEP_FIELDS: string[][] = [
  ['name'],
  ['channel'],
  ['targetMode', 'segmentId', 'contactIds'],
  ['senderAccountIds'],
  ['templateId'],
  ['scheduleMode', 'timezone', 'startAt'],
  [],
];

const DEFAULT_AUDIENCE_PAGINATION: ContactsPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
};

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-rose-400">{message}</p>;
}

function getContactLabel(contact: Contact): string {
  if (contact.fullName && contact.fullName.trim().length > 0) {
    return contact.fullName;
  }

  const fromParts = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  if (fromParts.length > 0) {
    return fromParts;
  }

  return contact.email ?? contact.phone ?? 'Contact';
}

function toggleId(ids: string[], id: string, checked: boolean): string[] {
  if (checked) {
    return Array.from(new Set([...ids, id]));
  }

  return ids.filter((item) => item !== id);
}

function formatCampaignTimestamp(timestamp?: string): string {
  if (!timestamp) {
    return 'Recently updated';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Recently updated';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getStatusBadgeVariant(status?: string): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
    case 'scheduled':
      return 'warning';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

function buildRerunDefaults(campaign: Campaign): CampaignBuilderFormValues {
  return {
    name: `${campaign.name} (rerun)`,
    description: '',
    channel: campaign.channel,
    targetMode: campaign.segmentId ? 'segment' : 'contacts',
    segmentId: campaign.segmentId ?? '',
    contactIds: campaign.segmentId ? [] : campaign.contactIds,
    senderAccountIds: campaign.senderAccountIds,
    templateId: '',
    scheduleMode: 'now',
    timezone: campaign.timezone || 'UTC',
    startAt: '',
    sendingWindowStart: campaign.sendingWindowStart ?? '',
    sendingWindowEnd: campaign.sendingWindowEnd ?? '',
    dailyCap: campaign.dailyCap ?? undefined,
  };
}

export function CampaignBuilder() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingRecentCampaigns, setIsLoadingRecentCampaigns] = useState(true);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isAudienceBulkLoading, setIsAudienceBulkLoading] = useState(false);
  const [isAudienceSaving, setIsAudienceSaving] = useState(false);
  const [lastLaunchedCampaignId, setLastLaunchedCampaignId] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [senderAccounts, setSenderAccounts] = useState<SenderAccount[]>([]);
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignAudience, setCampaignAudience] = useState<Contact[]>([]);
  const [audiencePagination, setAudiencePagination] = useState<ContactsPagination>(
    DEFAULT_AUDIENCE_PAGINATION,
  );
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<string[]>([]);
  const [audienceTagInput, setAudienceTagInput] = useState('');
  const [editingAudienceContact, setEditingAudienceContact] = useState<Contact | null>(null);

  const form = useForm<CampaignBuilderFormValues>({
    resolver: zodResolver(campaignBuilderSchema) as never,
    defaultValues: {
      name: '',
      description: '',
      channel: 'email',
      targetMode: 'segment',
      segmentId: '',
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

  const watchedChannel = useWatch({
    control: form.control,
    name: 'channel',
  }) ?? 'email';

  const watchedTargetMode = useWatch({
    control: form.control,
    name: 'targetMode',
  }) ?? 'segment';

  const watchedSegmentId = useWatch({
    control: form.control,
    name: 'segmentId',
  }) ?? '';

  const watchedContactIdsRaw = useWatch({
    control: form.control,
    name: 'contactIds',
  });
  const watchedContactIds = useMemo(
    () => watchedContactIdsRaw ?? [],
    [watchedContactIdsRaw],
  );

  const watchedSenderAccountIdsRaw = useWatch({
    control: form.control,
    name: 'senderAccountIds',
  });
  const watchedSenderAccountIds = useMemo(
    () => watchedSenderAccountIdsRaw ?? [],
    [watchedSenderAccountIdsRaw],
  );

  const watchedTemplateId = useWatch({
    control: form.control,
    name: 'templateId',
  }) ?? '';

  const watchedScheduleMode = useWatch({
    control: form.control,
    name: 'scheduleMode',
  }) ?? 'now';

  const loadOptions = useCallback(async (channel: 'email' | 'whatsapp') => {
    setIsLoadingOptions(true);

    const [contactsResult, segmentsResult, senderResult, templateResult] = await Promise.allSettled([
      getContacts({ page: 1, limit: 100 }),
      getSegments({ page: 1, limit: 100 }),
      getSenderAccounts(channel),
      getTemplates({ page: 1, limit: 100, type: channel }),
    ]);

    if (contactsResult.status === 'fulfilled') {
      setContacts(contactsResult.value.items);
    } else {
      setContacts([]);
    }

    if (segmentsResult.status === 'fulfilled') {
      setSegments(segmentsResult.value.items);
    } else {
      setSegments([]);
    }

    if (senderResult.status === 'fulfilled') {
      setSenderAccounts(senderResult.value);
    } else {
      setSenderAccounts([]);
    }

    if (templateResult.status === 'fulfilled') {
      setTemplates(templateResult.value.items);
    } else {
      setTemplates([]);
    }

    if (
      contactsResult.status === 'rejected' ||
      segmentsResult.status === 'rejected' ||
      senderResult.status === 'rejected' ||
      templateResult.status === 'rejected'
    ) {
      toast.error('Some campaign builder options failed to load.');
    }

    setIsLoadingOptions(false);
  }, []);

  useEffect(() => {
    void loadOptions(watchedChannel);
  }, [loadOptions, watchedChannel]);

  const loadRecentCampaigns = useCallback(async () => {
    setIsLoadingRecentCampaigns(true);

    try {
      const response = await getCampaigns({ page: 1, limit: 6 });
      setRecentCampaigns(response.items);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      setRecentCampaigns([]);
    } finally {
      setIsLoadingRecentCampaigns(false);
    }
  }, []);

  useEffect(() => {
    void loadRecentCampaigns();
  }, [loadRecentCampaigns]);

  const loadCampaignAudience = useCallback(
    async (campaign: Campaign, page = 1) => {
      setSelectedCampaign(campaign);
      setIsLoadingAudience(true);

      try {
        const response = await getCampaignContacts(campaign.id, {
          page,
          limit: audiencePagination.limit,
        });
        setCampaignAudience(response.items);
        setAudiencePagination(response.pagination);
        setSelectedAudienceIds([]);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error));
        setCampaignAudience([]);
        setAudiencePagination(DEFAULT_AUDIENCE_PAGINATION);
      } finally {
        setIsLoadingAudience(false);
      }
    },
    [audiencePagination.limit],
  );

  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.id === watchedSegmentId),
    [segments, watchedSegmentId],
  );

  const selectedContacts = useMemo(() => {
    const selectedIds = new Set(watchedContactIds);
    return contacts.filter((contact) => selectedIds.has(contact.id));
  }, [contacts, watchedContactIds]);

  const selectedSenderAccounts = useMemo(() => {
    const selectedIds = new Set(watchedSenderAccountIds);
    return senderAccounts.filter((sender) => selectedIds.has(sender.id));
  }, [senderAccounts, watchedSenderAccountIds]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === watchedTemplateId),
    [templates, watchedTemplateId],
  );

  const handleNext = async () => {
    const fields = STEP_FIELDS[currentStep];
    if (fields.length > 0) {
      const isValid = await form.trigger(fields as never, { shouldFocus: true });
      if (!isValid) {
        return;
      }
    }

    setCurrentStep((prev) => Math.min(CAMPAIGN_STEPS.length - 1, prev + 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleLaunch = form.handleSubmit(async (values) => {
    setIsLaunching(true);

    try {
      const campaign = await createCampaign(values as CampaignBuilderValues);
      await startCampaign(campaign.id);

      setLastLaunchedCampaignId(campaign.id);
      toast.success(`Campaign "${campaign.name}" launched.`);
      await loadRecentCampaigns();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLaunching(false);
    }
  });

  const handleReuseCampaign = (campaign: Campaign) => {
    form.reset(buildRerunDefaults(campaign));
    setCurrentStep(4);
    setLastLaunchedCampaignId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success(`"${campaign.name}" loaded. Pick a different template and launch when ready.`);
  };

  const handleOpenCampaignAudience = (campaign: Campaign) => {
    void loadCampaignAudience(campaign, 1);
  };

  const handleToggleSelectAllAudience = (checked: boolean) => {
    if (!checked) {
      setSelectedAudienceIds([]);
      return;
    }

    setSelectedAudienceIds(campaignAudience.map((contact) => contact.id));
  };

  const handleToggleSelectAudience = (contactId: string, checked: boolean) => {
    if (checked) {
      setSelectedAudienceIds((prev) => Array.from(new Set([...prev, contactId])));
      return;
    }

    setSelectedAudienceIds((prev) => prev.filter((id) => id !== contactId));
  };

  const handleBulkAddAudienceTag = async () => {
    const newTag = audienceTagInput.trim();
    if (!newTag || selectedAudienceIds.length === 0) {
      return;
    }

    setIsAudienceBulkLoading(true);

    try {
      const result = await bulkAddTagToContacts(selectedAudienceIds, newTag);
      toast.success(`Tag "${newTag}" added to ${result.modified} of ${result.requested} users.`);
      setAudienceTagInput('');
      if (selectedCampaign) {
        await loadCampaignAudience(selectedCampaign, audiencePagination.page);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsAudienceBulkLoading(false);
    }
  };

  const handleSaveAudienceContact = async (values: ContactFormValues) => {
    if (!editingAudienceContact) {
      return;
    }

    setIsAudienceSaving(true);

    try {
      await updateContact(editingAudienceContact.id, values);
      toast.success('User updated.');
      setEditingAudienceContact(null);
      if (selectedCampaign) {
        await loadCampaignAudience(selectedCampaign, audiencePagination.page);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      throw error;
    } finally {
      setIsAudienceSaving(false);
    }
  };

  const audienceSummaryLabel = useMemo(() => {
    if (!selectedCampaign) {
      return '';
    }

    return selectedCampaign.segmentId
      ? 'Segment-based audience'
      : `${selectedCampaign.contactIds.length} direct contacts`;
  }, [selectedCampaign]);

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              className="border-zinc-800 bg-zinc-900 text-zinc-100"
              placeholder="April Product Launch"
              {...form.register('name')}
            />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={4}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              placeholder="Campaign for announcing new product features."
              {...form.register('description')}
            />
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">Choose which channel this campaign should use.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['email', 'whatsapp'] as const).map((channel) => (
              <button
                key={channel}
                type="button"
                className={`rounded-lg border p-4 text-left transition-colors ${
                  watchedChannel === channel
                    ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                }`}
                onClick={() => {
                  form.setValue('channel', channel, { shouldDirty: true });
                  form.setValue('senderAccountIds', [], { shouldDirty: true });
                  form.setValue('templateId', '', { shouldDirty: true });
                }}
              >
                <p className="font-medium capitalize">{channel}</p>
                <p className="mt-1 text-xs opacity-80">
                  {channel === 'email'
                    ? 'Use email sender accounts and email templates.'
                    : 'Use WhatsApp sender accounts and approved templates.'}
                </p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-4">
          <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
            {(['segment', 'contacts'] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={watchedTargetMode === mode ? 'default' : 'ghost'}
                className={watchedTargetMode === mode ? '' : 'text-zinc-400 hover:text-zinc-100'}
                onClick={() => form.setValue('targetMode', mode)}
              >
                {mode === 'segment' ? 'Use Segment' : 'Select Contacts'}
              </Button>
            ))}
          </div>

          {isLoadingOptions ? (
            <p className="text-sm text-zinc-500">Loading audience options...</p>
          ) : watchedTargetMode === 'segment' ? (
            <div className="space-y-2">
              {segments.length === 0 ? (
                <p className="text-sm text-zinc-500">No segments found.</p>
              ) : (
                segments.map((segment) => (
                  <label
                    key={segment.id}
                    className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{segment.name}</p>
                      <p className="text-xs text-zinc-500">{segment.estimatedCount} contacts</p>
                    </div>
                    <input
                      type="radio"
                      className="h-4 w-4"
                      checked={watchedSegmentId === segment.id}
                      onChange={() => form.setValue('segmentId', segment.id, { shouldDirty: true })}
                    />
                  </label>
                ))
              )}
              <FieldError message={form.formState.errors.segmentId?.message} />
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-zinc-800 p-2">
              {contacts.length === 0 ? (
                <p className="px-2 py-3 text-sm text-zinc-500">No contacts found.</p>
              ) : (
                contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{getContactLabel(contact)}</p>
                      <p className="text-xs text-zinc-500">{contact.email ?? contact.phone ?? '-'}</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={watchedContactIds.includes(contact.id)}
                      onChange={(event) =>
                        form.setValue(
                          'contactIds',
                          toggleId(watchedContactIds, contact.id, event.target.checked),
                          { shouldDirty: true },
                        )
                      }
                    />
                  </label>
                ))
              )}
              <FieldError message={form.formState.errors.contactIds?.message as string | undefined} />
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">Select one or more sender accounts.</p>
          {isLoadingOptions ? (
            <p className="text-sm text-zinc-500">Loading sender accounts...</p>
          ) : senderAccounts.length === 0 ? (
            <p className="text-sm text-zinc-500">No sender accounts found for this channel.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-zinc-800 p-2">
              {senderAccounts.map((sender) => (
                <label
                  key={sender.id}
                  className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{sender.name}</p>
                    <p className="text-xs text-zinc-500">
                      {sender.type === 'email' ? sender.email : sender.phoneNumber}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={watchedSenderAccountIds.includes(sender.id)}
                    onChange={(event) =>
                      form.setValue(
                        'senderAccountIds',
                        toggleId(watchedSenderAccountIds, sender.id, event.target.checked),
                        { shouldDirty: true },
                      )
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <FieldError message={form.formState.errors.senderAccountIds?.message as string | undefined} />
        </div>
      );
    }

    if (currentStep === 4) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">Pick the template used for message rendering.</p>
          {isLoadingOptions ? (
            <p className="text-sm text-zinc-500">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-zinc-500">No templates found for this channel.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-zinc-800 p-2">
              {templates.map((template) => (
                <label
                  key={template.id}
                  className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{template.name}</p>
                    <p className="line-clamp-1 text-xs text-zinc-500">{template.subject}</p>
                  </div>
                  <input
                    type="radio"
                    className="h-4 w-4"
                    checked={watchedTemplateId === template.id}
                    onChange={() => form.setValue('templateId', template.id, { shouldDirty: true })}
                  />
                </label>
              ))}
            </div>
          )}
          <FieldError message={form.formState.errors.templateId?.message} />
        </div>
      );
    }

    if (currentStep === 5) {
      return (
        <div className="space-y-4">
          <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
            {(['now', 'scheduled'] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={watchedScheduleMode === mode ? 'default' : 'ghost'}
                className={watchedScheduleMode === mode ? '' : 'text-zinc-400 hover:text-zinc-100'}
                onClick={() => form.setValue('scheduleMode', mode)}
              >
                {mode === 'now' ? 'Launch Immediately' : 'Schedule'}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="UTC"
                {...form.register('timezone')}
              />
              <FieldError message={form.formState.errors.timezone?.message} />
            </div>

            {watchedScheduleMode === 'scheduled' && (
              <div className="space-y-2">
                <Label htmlFor="startAt">Start At</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  className="border-zinc-800 bg-zinc-900 text-zinc-100"
                  {...form.register('startAt')}
                />
                <FieldError message={form.formState.errors.startAt?.message} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sendingWindowStart">Sending Window Start</Label>
              <Input
                id="sendingWindowStart"
                type="time"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                {...form.register('sendingWindowStart')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sendingWindowEnd">Sending Window End</Label>
              <Input
                id="sendingWindowEnd"
                type="time"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                {...form.register('sendingWindowEnd')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyCap">Daily Cap</Label>
              <Input
                id="dailyCap"
                type="number"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="1000"
                {...form.register('dailyCap')}
              />
            </div>
          </div>
        </div>
      );
    }

    const values = form.getValues();

    return (
      <div className="space-y-4">
        {lastLaunchedCampaignId && (
          <div className="rounded-md border border-emerald-700/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Last launch successful. Campaign ID: {lastLaunchedCampaignId}
          </div>
        )}

        <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-base">Campaign Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-zinc-500">Name:</span> {values.name}
            </p>
            <p>
              <span className="text-zinc-500">Channel:</span>{' '}
              <Badge variant={values.channel === 'email' ? 'neutral' : 'warning'}>
                {values.channel}
              </Badge>
            </p>
            <p>
              <span className="text-zinc-500">Audience:</span>{' '}
              {values.targetMode === 'segment'
                ? selectedSegment?.name ?? 'No segment selected'
                : `${selectedContacts.length} contacts selected`}
            </p>
            <p>
              <span className="text-zinc-500">Sender Accounts:</span>{' '}
              {selectedSenderAccounts.length}
            </p>
            <p>
              <span className="text-zinc-500">Template:</span>{' '}
              {selectedTemplate?.name ?? 'No template selected'}
            </p>
            <p>
              <span className="text-zinc-500">Schedule:</span>{' '}
              {values.scheduleMode === 'scheduled'
                ? `Scheduled at ${values.startAt || '-'} (${values.timezone})`
                : `Launch immediately (${values.timezone})`}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Campaign Builder</h2>
        <p className="text-sm text-zinc-400">
          Configure and launch campaigns through a guided SaaS workflow.
        </p>
      </div>

      <CampaignStepper
        steps={CAMPAIGN_STEPS}
        currentStep={currentStep}
        onStepClick={(stepIndex) => {
          if (stepIndex <= currentStep) {
            setCurrentStep(stepIndex);
          }
        }}
      />

      <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">{CAMPAIGN_STEPS[currentStep].label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {renderStepContent()}

          <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              onClick={handleBack}
              disabled={currentStep === 0 || isLaunching}
            >
              Back
            </Button>

            {currentStep < CAMPAIGN_STEPS.length - 1 ? (
              <Button type="button" onClick={() => void handleNext()} disabled={isLaunching}>
                Next Step
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleLaunch()} disabled={isLaunching}>
                {isLaunching ? 'Launching...' : 'Launch Campaign'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Recent Campaigns</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              Click a campaign to see its users. Use `Run Again` to reuse it with a different template.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            onClick={() => void loadRecentCampaigns()}
            disabled={isLoadingRecentCampaigns}
          >
            {isLoadingRecentCampaigns ? 'Refreshing...' : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingRecentCampaigns ? (
            <p className="text-sm text-zinc-500">Loading recent campaigns...</p>
          ) : recentCampaigns.length === 0 ? (
            <p className="text-sm text-zinc-500">No campaigns found yet. Launch one to reuse it here.</p>
          ) : (
            recentCampaigns.map((campaign) => {
              const isSelected = selectedCampaign?.id === campaign.id;

              return (
                <div
                  key={campaign.id}
                  className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-4 transition-colors lg:flex-row lg:items-center lg:justify-between ${
                    isSelected
                      ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
                      : 'border-zinc-800 bg-zinc-950/60 text-zinc-100 hover:bg-zinc-900'
                  }`}
                  onClick={() => handleOpenCampaignAudience(campaign)}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{campaign.name}</p>
                      <Badge variant={campaign.channel === 'email' ? 'neutral' : 'warning'}>
                        {campaign.channel}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(campaign.status)}>
                        {campaign.status ?? 'draft'}
                      </Badge>
                    </div>
                    <div
                      className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${
                        isSelected ? 'text-zinc-700' : 'text-zinc-500'
                      }`}
                    >
                      <span>
                        Audience:{' '}
                        {campaign.segmentId
                          ? 'Segment-based'
                          : `${campaign.contactIds.length} direct contacts`}
                      </span>
                      <span>Senders: {campaign.senderAccountIds.length}</span>
                      <span>Recipients: {campaign.stats?.totalRecipients ?? 0}</span>
                      <span>{formatCampaignTimestamp(campaign.updatedAt ?? campaign.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleReuseCampaign(campaign);
                    }}
                  >
                    Run Again
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {selectedCampaign && (
        <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Campaign Users</CardTitle>
                <p className="mt-1 text-sm text-zinc-400">
                  {selectedCampaign.name} • {audienceSummaryLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                onClick={() => void loadCampaignAudience(selectedCampaign, audiencePagination.page)}
                disabled={isLoadingAudience}
              >
                {isLoadingAudience ? 'Refreshing...' : 'Refresh Users'}
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-400">{selectedAudienceIds.length} selected</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  className="h-9 border-zinc-800 bg-zinc-900 text-zinc-100"
                  placeholder="Tag to add"
                  value={audienceTagInput}
                  onChange={(event) => setAudienceTagInput(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                  onClick={() => void handleBulkAddAudienceTag()}
                  disabled={
                    selectedAudienceIds.length === 0 ||
                    !audienceTagInput.trim() ||
                    isAudienceBulkLoading
                  }
                >
                  {isAudienceBulkLoading ? 'Applying...' : 'Add Tag to Selected'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingAudience ? (
              <p className="text-sm text-zinc-500">Loading campaign users...</p>
            ) : campaignAudience.length === 0 ? (
              <p className="text-sm text-zinc-500">No users found for this campaign.</p>
            ) : (
              campaignAudience.map((contact) => {
                const isChecked = selectedAudienceIds.includes(contact.id);

                return (
                  <div
                    key={contact.id}
                    className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={isChecked}
                        onChange={(event) =>
                          handleToggleSelectAudience(contact.id, event.target.checked)
                        }
                      />
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-zinc-100">
                            {getContactLabel(contact)}
                          </p>
                          <Badge variant="neutral">
                            {contact.subscriptionStatus ?? 'subscribed'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                          <span>{contact.email ?? contact.phone ?? 'No contact method'}</span>
                          {contact.company ? <span>{contact.company}</span> : null}
                          {contact.tags.length > 0 ? (
                            <span>Tags: {contact.tags.join(', ')}</span>
                          ) : (
                            <span>No tags</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button type="button" variant="outline" onClick={() => setEditingAudienceContact(contact)}>
                      Edit User
                    </Button>
                  </div>
                );
              })
            )}

            {campaignAudience.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={
                      campaignAudience.length > 0 &&
                      selectedAudienceIds.length === campaignAudience.length
                    }
                    onChange={(event) => handleToggleSelectAllAudience(event.target.checked)}
                  />
                  Select all on this page
                </label>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-zinc-500">
                    Page {audiencePagination.page} of {audiencePagination.totalPages} •{' '}
                    {audiencePagination.total} users
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    disabled={audiencePagination.page <= 1 || isLoadingAudience}
                    onClick={() =>
                      selectedCampaign &&
                      void loadCampaignAudience(selectedCampaign, audiencePagination.page - 1)
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    disabled={
                      audiencePagination.page >= audiencePagination.totalPages || isLoadingAudience
                    }
                    onClick={() =>
                      selectedCampaign &&
                      void loadCampaignAudience(selectedCampaign, audiencePagination.page + 1)
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ContactFormDialog
        open={Boolean(editingAudienceContact)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAudienceContact(null);
          }
        }}
        contact={editingAudienceContact}
        onSubmit={handleSaveAudienceContact}
        isSubmitting={isAudienceSaving}
      />
    </section>
  );
}
