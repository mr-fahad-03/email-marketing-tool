'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import type { SenderAccount } from '@/lib/types/sender-account';
import {
  createSenderAccountSchema,
  type SenderAccountFormValues,
  updateSenderAccountSchema,
} from '@/lib/validators/sender-account';

interface SenderAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: SenderAccount | null;
  isSubmitting?: boolean;
  onSubmit: (values: SenderAccountFormValues) => Promise<void>;
  onRevealSmtpPassword?: (accountId: string) => Promise<string>;
}

function getDefaultValues(account?: SenderAccount | null): SenderAccountFormValues {
  if (!account) {
    return {
      type: 'email',
      name: '',
      status: 'active',
      email: '',
      providerType: '',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
      secure: false,
      dailyLimit: undefined,
      hourlyLimit: undefined,
      minDelaySeconds: undefined,
      maxDelaySeconds: undefined,
    };
  }

  if (account.type === 'email') {
    return {
      type: 'email',
      name: account.name,
      status: account.status ?? 'active',
      email: account.email,
      providerType: account.providerType ?? '',
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpUser: account.smtpUser,
      smtpPass: account.smtpPass ?? '',
      secure: account.secure ?? false,
      dailyLimit: account.dailyLimit,
      hourlyLimit: account.hourlyLimit,
      minDelaySeconds: account.minDelaySeconds,
      maxDelaySeconds: account.maxDelaySeconds,
    };
  }

  return {
    type: 'whatsapp',
    name: account.name,
    status: account.status ?? 'active',
    phoneNumber: account.phoneNumber,
    businessAccountId: account.businessAccountId ?? '',
    phoneNumberId: account.phoneNumberId,
    accessToken: '',
    webhookVerifyToken: '',
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-rose-400">{message}</p>;
}

export function SenderAccountFormDialog({
  open,
  onOpenChange,
  account,
  isSubmitting = false,
  onSubmit,
  onRevealSmtpPassword,
}: SenderAccountFormDialogProps) {
  const secretMask = '********';
  const isEdit = Boolean(account);
  const schema = isEdit ? updateSenderAccountSchema : createSenderAccountSchema;
  const form = useForm<SenderAccountFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: getDefaultValues(account),
  });
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [isRevealingSmtpPassword, setIsRevealingSmtpPassword] = useState(false);

  const type = useWatch({
    control: form.control,
    name: 'type',
  }) as SenderAccountFormValues['type'] | undefined;
  const selectedType = type ?? account?.type ?? 'email';

  useEffect(() => {
    form.reset(getDefaultValues(account));
    setShowSmtpPassword(false);
    setIsRevealingSmtpPassword(false);
  }, [account, form, open]);

  const handleSmtpPasswordVisibilityToggle = async () => {
    if (showSmtpPassword) {
      setShowSmtpPassword(false);
      return;
    }

    if (
      !isEdit ||
      !account ||
      account.type !== 'email' ||
      !onRevealSmtpPassword
    ) {
      setShowSmtpPassword(true);
      return;
    }

    const smtpPassValue = form.getValues('smtpPass');
    if (smtpPassValue !== secretMask) {
      setShowSmtpPassword(true);
      return;
    }

    setIsRevealingSmtpPassword(true);
    form.clearErrors('smtpPass');

    try {
      const revealedPassword = await onRevealSmtpPassword(account.id);
      form.setValue('smtpPass', revealedPassword, {
        shouldDirty: false,
        shouldTouch: true,
      });
      setShowSmtpPassword(true);
    } catch {
      form.setError('smtpPass', {
        type: 'manual',
        message: 'Unable to reveal saved SMTP password. Please try again.',
      });
    } finally {
      setIsRevealingSmtpPassword(false);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    form.reset(getDefaultValues(null));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Sender Account' : 'Add Sender Account'}</DialogTitle>
          <DialogDescription>
            Configure sender credentials and limits for outbound campaigns.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                disabled={isEdit || isSubmitting}
                {...form.register('type')}
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                disabled={isSubmitting}
                {...form.register('status')}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="Primary Sender"
                disabled={isSubmitting}
                {...form.register('name')}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
          </div>

          {selectedType === 'email' ? (
            <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">SMTP Configuration</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Sender Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('email')}
                  />
                  <FieldError message={form.formState.errors.email?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="providerType">Provider Type</Label>
                  <Input
                    id="providerType"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    placeholder="smtp / ses / sendgrid"
                    {...form.register('providerType')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    placeholder="smtp.gmail.com"
                    {...form.register('smtpHost')}
                  />
                  <FieldError message={form.formState.errors.smtpHost?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('smtpPort', { valueAsNumber: true })}
                  />
                  <FieldError message={form.formState.errors.smtpPort?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP User</Label>
                  <Input
                    id="smtpUser"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('smtpUser')}
                  />
                  <FieldError message={form.formState.errors.smtpUser?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPass">SMTP Password</Label>
                  <div className="relative">
                    <Input
                      id="smtpPass"
                      type={showSmtpPassword ? 'text' : 'password'}
                      className="border-zinc-800 bg-zinc-900 pr-10 text-zinc-100"
                      {...form.register('smtpPass')}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-zinc-400 hover:text-zinc-200"
                      onClick={() => {
                        void handleSmtpPasswordVisibilityToggle();
                      }}
                      disabled={isRevealingSmtpPassword}
                      aria-label={showSmtpPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FieldError message={form.formState.errors.smtpPass?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyLimit">Daily Limit</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('dailyLimit')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourlyLimit">Hourly Limit</Label>
                  <Input
                    id="hourlyLimit"
                    type="number"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('hourlyLimit')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minDelaySeconds">Min Delay (sec)</Label>
                  <Input
                    id="minDelaySeconds"
                    type="number"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('minDelaySeconds')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDelaySeconds">Max Delay (sec)</Label>
                  <Input
                    id="maxDelaySeconds"
                    type="number"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('maxDelaySeconds')}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" className="h-4 w-4 rounded border-zinc-700 bg-zinc-900" {...form.register('secure')} />
                Use secure SMTP connection
              </label>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">WhatsApp Configuration</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    placeholder="+1 415 555 0182"
                    {...form.register('phoneNumber')}
                  />
                  <FieldError message={form.formState.errors.phoneNumber?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessAccountId">Business Account ID</Label>
                  <Input
                    id="businessAccountId"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('businessAccountId')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                  <Input
                    id="phoneNumberId"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('phoneNumberId')}
                  />
                  <FieldError message={form.formState.errors.phoneNumberId?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessToken">{isEdit ? 'Access Token (optional)' : 'Access Token'}</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('accessToken')}
                  />
                  <FieldError message={form.formState.errors.accessToken?.message} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="webhookVerifyToken">
                    {isEdit ? 'Webhook Verify Token (optional)' : 'Webhook Verify Token'}
                  </Label>
                  <Input
                    id="webhookVerifyToken"
                    type="password"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    {...form.register('webhookVerifyToken')}
                  />
                  <FieldError message={form.formState.errors.webhookVerifyToken?.message} />
                </div>
              </div>
            </div>
          )}

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
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Sender'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
