'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import type { Contact } from '@/lib/types/contact';
import { contactFormSchema, type ContactFormValues } from '@/lib/validators/contact';

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  isSubmitting?: boolean;
  onSubmit: (values: ContactFormValues) => Promise<void>;
}

function getDefaultValues(contact?: Contact | null): ContactFormValues {
  return {
    firstName: contact?.firstName ?? '',
    lastName: contact?.lastName ?? '',
    fullName: contact?.fullName ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    company: contact?.company ?? '',
    tags: contact?.tags ?? [],
    source: contact?.source ?? '',
    notes: contact?.notes ?? '',
    subscriptionStatus: contact?.subscriptionStatus ?? 'subscribed',
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-rose-400">{message}</p>;
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  isSubmitting = false,
  onSubmit,
}: ContactFormDialogProps) {
  const isEdit = Boolean(contact);
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema) as never,
    defaultValues: getDefaultValues(contact),
  });

  const tags = useWatch({
    control: form.control,
    name: 'tags',
  }) ?? [];

  useEffect(() => {
    form.reset(getDefaultValues(contact));
  }, [contact, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          <DialogDescription>
            Manage contact profile, tags, and subscription metadata.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                {...form.register('firstName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                {...form.register('lastName')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                {...form.register('fullName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                {...form.register('email')}
              />
              <FieldError message={form.formState.errors.email?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                {...form.register('phone')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                {...form.register('company')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscriptionStatus">Subscription Status</Label>
              <select
                id="subscriptionStatus"
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                {...form.register('subscriptionStatus')}
              >
                <option value="subscribed">Subscribed</option>
                <option value="pending">Pending</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="suppressed">Suppressed</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="vip, newsletter, trial"
                value={tags.join(', ')}
                onChange={(event) => {
                  form.setValue('tags', parseTags(event.target.value), {
                    shouldDirty: true,
                    shouldValidate: false,
                  });
                }}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="source">Source</Label>
              <select
                id="source"
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                {...form.register('source')}
              >
                <option value="">Select source</option>
                <option value="manual">Manual</option>
                <option value="csv_import">CSV Import</option>
                <option value="api">API</option>
                <option value="webhook">Webhook</option>
              </select>
              <FieldError message={form.formState.errors.source?.message} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                rows={3}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                {...form.register('notes')}
              />
            </div>
          </div>

          <FieldError message={form.formState.errors.root?.message} />

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
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
