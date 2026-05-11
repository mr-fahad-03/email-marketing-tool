'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SenderAccountFormDialog } from '@/components/sender-accounts/sender-account-form-dialog';
import { SenderAccountsTable } from '@/components/sender-accounts/sender-accounts-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HttpClientError } from '@/lib/api/errors';
import {
  createSenderAccount,
  deleteSenderAccount,
  getSenderAccounts,
  revealSenderAccountSmtpPassword,
  testSenderAccount,
  updateSenderAccount,
} from '@/lib/api/sender-accounts';
import type { SenderAccount, SenderAccountType } from '@/lib/types/sender-account';
import type { SenderAccountFormValues } from '@/lib/validators/sender-account';

type TypeFilter = 'all' | SenderAccountType;

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export default function SenderAccountsPage() {
  const [accounts, setAccounts] = useState<SenderAccount[]>([]);
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<SenderAccount | null>(null);

  const loadAccounts = useCallback(async (typeFilter: TypeFilter) => {
    setIsLoading(true);

    try {
      const payload = await getSenderAccounts(typeFilter === 'all' ? undefined : typeFilter);
      setAccounts(payload);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts(filter);
  }, [filter, loadAccounts]);

  const filteredAccounts = useMemo(() => {
    if (filter === 'all') {
      return accounts;
    }

    return accounts.filter((account) => account.type === filter);
  }, [accounts, filter]);

  const openCreate = () => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

  const openEdit = (account: SenderAccount) => {
    setEditingAccount(account);
    setIsDialogOpen(true);
  };

  const closeDialog = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingAccount(null);
    }
  };

  const handleSave = async (values: SenderAccountFormValues) => {
    setIsSaving(true);

    try {
      if (editingAccount) {
        const payload: SenderAccountFormValues = { ...values };

        // Keep existing secret when the masked value was left unchanged in edit mode.
        if (
          editingAccount.type === 'email' &&
          payload.type === 'email' &&
          payload.smtpPass === editingAccount.smtpPass
        ) {
          payload.smtpPass = '';
        }

        await updateSenderAccount(editingAccount.id, payload);
        toast.success('Sender account updated.');
      } else {
        await createSenderAccount(values);
        toast.success('Sender account created.');
      }

      closeDialog(false);
      await loadAccounts(filter);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (account: SenderAccount) => {
    const confirmed = window.confirm(`Delete "${account.name}" sender account?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(account.id);

    try {
      await deleteSenderAccount(account.id);
      toast.success('Sender account deleted.');
      await loadAccounts(filter);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTestConnection = async (account: SenderAccount) => {
    setTestingId(account.id);

    try {
      const result = await testSenderAccount(account.id);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      await loadAccounts(filter);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setTestingId(null);
    }
  };

  const handleRevealSmtpPassword = useCallback(async (accountId: string) => {
    return revealSenderAccountSmtpPassword(accountId);
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Sender Accounts</h2>
          <p className="text-sm text-zinc-400">
            Manage email and WhatsApp sender identities, limits, and health.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Sender Account
        </Button>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Accounts</CardTitle>
          <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
            {(['all', 'email', 'whatsapp'] as const).map((item) => (
              <Button
                key={item}
                variant={filter === item ? 'default' : 'ghost'}
                size="sm"
                className={filter === item ? '' : 'text-zinc-400 hover:text-zinc-100'}
                onClick={() => setFilter(item)}
              >
                {item === 'all' ? 'All' : item === 'email' ? 'Email' : 'WhatsApp'}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <SenderAccountsTable
            accounts={filteredAccounts}
            isLoading={isLoading}
            testingId={testingId}
            deletingId={deletingId}
            onEdit={openEdit}
            onDelete={handleDelete}
            onTest={handleTestConnection}
          />
        </CardContent>
      </Card>

      <SenderAccountFormDialog
        open={isDialogOpen}
        onOpenChange={closeDialog}
        account={editingAccount}
        onSubmit={handleSave}
        isSubmitting={isSaving}
        onRevealSmtpPassword={handleRevealSmtpPassword}
      />
    </section>
  );
}

