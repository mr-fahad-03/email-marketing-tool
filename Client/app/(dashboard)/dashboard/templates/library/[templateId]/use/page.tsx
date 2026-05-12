'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutTemplateEditor } from '@/components/templates/layout-template-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HttpClientError } from '@/lib/api/errors';
import { createTemplate, getMjmlProviderTemplateById } from '@/lib/api/templates';
import {
  clearLibraryTemplateDraft,
  readLibraryTemplateDraft,
  saveLibraryTemplateDraft,
} from '@/lib/templates/library-template-draft';
import type { ProviderTemplateDetail, TemplateCategory } from '@/lib/types/template';
import { templateFormSchema, type TemplateFormValues } from '@/lib/validators/template';

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

function inferCategoryFromHints(hints: string[]): TemplateCategory {
  const first = hints[0];
  if (
    first === 'business' ||
    first === 'ecommerce' ||
    first === 'restaurant' ||
    first === 'other' ||
    first === 'holiday' ||
    first === 'travel' ||
    first === 'online-store' ||
    first === 'kitchen' ||
    first === 'medicine' ||
    first === 'education' ||
    first === 'holidays' ||
    first === 'tourism'
  ) {
    return first;
  }

  return 'general';
}

function getDefaultValues(template: ProviderTemplateDetail | null): TemplateFormValues {
  const category = template ? inferCategoryFromHints(template.categoryHints) : 'general';
  return {
    type: 'email',
    editorType: 'layout',
    layoutPreset: null,
    designJson: null,
    mjmlBody: template?.mjml ?? null,
    category,
    name: template ? `${template.name} copy` : '',
    subject: template?.name ?? '',
    body: template?.html ?? '',
    status: 'active',
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-rose-500">{message}</p>;
}

export default function UseTemplatePage() {
  const router = useRouter();
  const params = useParams<{ templateId: string }>();
  const templateId = decodeURIComponent(params.templateId);

  const [providerTemplate, setProviderTemplate] = useState<ProviderTemplateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalSaving, setIsFinalSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [isNameStepOpen, setIsNameStepOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema) as never,
    defaultValues: getDefaultValues(null),
  });

  useEffect(() => {
    form.register('designJson');
    form.register('mjmlBody');
  }, [form]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      setIsLoading(true);
      setError(null);
      try {
        const detail = await getMjmlProviderTemplateById(templateId);
        if (!cancelled) {
          setProviderTemplate(detail);
          form.reset(getDefaultValues(detail));
          setIsDraftSaved(false);
          // Always start from the original library template when entering edit mode.
          clearLibraryTemplateDraft(templateId);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setProviderTemplate(null);
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [form, templateId]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const watchedDesignJson = useWatch({
    control: form.control,
    name: 'designJson',
  });

  const watchedName = useWatch({
    control: form.control,
    name: 'name',
  });
  const watchedBody = useWatch({
    control: form.control,
    name: 'body',
  });
  const watchedMjmlBody = useWatch({
    control: form.control,
    name: 'mjmlBody',
  });

  useEffect(() => {
    const name = (watchedName ?? '').trim();
    if (name.length > 0) {
      setTemplateName(name);
    }
  }, [watchedName]);

  const hasUnsavedChanges = form.formState.isDirty;
  const canGoNext = isDraftSaved && !hasUnsavedChanges;

  useEffect(() => {
    if (hasUnsavedChanges) {
      setIsDraftSaved(false);
      setIsNameStepOpen(false);
    }
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (isLoading || !providerTemplate || !hasUnsavedChanges) {
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      try {
        const values = form.getValues();
        saveLibraryTemplateDraft(templateId, values);
        form.reset(values);
        setIsDraftSaved(true);
      } catch {
        setError('Failed to auto-save draft changes. Please try again.');
      } finally {
        autoSaveTimerRef.current = null;
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    form,
    hasUnsavedChanges,
    isLoading,
    providerTemplate,
    templateId,
    watchedBody,
    watchedDesignJson,
    watchedMjmlBody,
    watchedName,
  ]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      saveLibraryTemplateDraft(templateId, values);
      form.reset(values);
      setIsDraftSaved(true);
      toast.success('Changes saved.');
    } catch {
      setError('Failed to save draft changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  });

  const finalizedName = useMemo(() => templateName.trim(), [templateName]);

  const handleFinalSave = async () => {
    if (hasUnsavedChanges) {
      toast.error('Please save your latest editor changes first.');
      return;
    }

    if (finalizedName.length < 2) {
      toast.error('Template name must be at least 2 characters.');
      return;
    }

    setIsFinalSaving(true);
    try {
      const values = form.getValues();
      const payload: TemplateFormValues = {
        ...values,
        name: finalizedName,
      };
      await createTemplate(payload);
      clearLibraryTemplateDraft(templateId);
      toast.success('Template created successfully.');
      router.push('/dashboard/templates');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsFinalSaving(false);
    }
  };

  const handleBackFromEditor = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to leave the editor? Your current changes will be auto-saved as a personal template.',
    );
    if (!confirmed) {
      return;
    }

    const hasDraftSnapshot = Boolean(readLibraryTemplateDraft(templateId));
    const shouldCreatePersonalTemplate = hasUnsavedChanges || isDraftSaved || hasDraftSnapshot;

    if (!shouldCreatePersonalTemplate) {
      router.push(`/dashboard/templates/library/${encodeURIComponent(templateId)}/preview`);
      return;
    }

    setIsLeaving(true);
    try {
      const values = form.getValues();
      const fallbackName = providerTemplate ? `${providerTemplate.name} copy` : 'Template copy';
      const payload: TemplateFormValues = {
        ...values,
        name: (values.name ?? '').trim() || fallbackName,
      };
      await createTemplate(payload);
      clearLibraryTemplateDraft(templateId);
      toast.success('Changes auto-saved to Personal Templates.');
      router.push('/dashboard/templates');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <section className="relative h-full w-full overflow-hidden">

      {isLoading ? (
        <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
          <CardContent className="py-10 text-sm text-zinc-400">Loading selected template...</CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-rose-800/40 bg-rose-900/20 text-rose-100">
          <CardContent className="py-8 text-sm">{error}</CardContent>
        </Card>
      ) : null}

      {providerTemplate ? (
        <form
          id="template-editor-form"
          className="flex h-full min-h-0 w-full flex-col"
          onSubmit={handleSubmit}
        >
          <input type="hidden" {...form.register('type')} />
          <input type="hidden" {...form.register('editorType')} />
          <input type="hidden" {...form.register('category')} />
          <input type="hidden" {...form.register('status')} />

          <div className="flex h-full min-h-0 w-full flex-col">
            <Controller
              control={form.control}
              name="body"
              render={({ field }) => (
                <LayoutTemplateEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  designJson={
                    watchedDesignJson && typeof watchedDesignJson === 'object'
                      ? watchedDesignJson
                      : null
                  }
                  onDesignChange={(design) => {
                    form.setValue('designJson', design, {
                      shouldDirty: true,
                    });
                  }}
                  mjmlValue={form.getValues('mjmlBody') ?? null}
                  onMjmlChange={(mjml) => {
                    form.setValue('mjmlBody', mjml, {
                      shouldDirty: true,
                    });
                  }}
                  headerActions={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-cyan-200 bg-white/95 text-[#0b5066] hover:bg-white"
                        onClick={() => void handleBackFromEditor()}
                        disabled={isLeaving || isSaving || isFinalSaving}
                      >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="bg-white text-[#0b5066] hover:bg-cyan-50"
                        disabled={isLoading || isSaving || isLeaving || !hasUnsavedChanges}
                      >
                        <Save className="mr-1 h-4 w-4" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                      {canGoNext ? (
                        <Button
                          type="button"
                          className="bg-cyan-100 text-[#0b5066] hover:bg-cyan-200"
                          onClick={() => setIsNameStepOpen(true)}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Next
                        </Button>
                      ) : null}
                    </>
                  }
                  previewHeaderActions={
                    canGoNext ? (
                      <Button
                        type="button"
                        className="bg-cyan-100 text-[#0b5066] hover:bg-cyan-200"
                        onClick={() => setIsNameStepOpen(true)}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Next
                      </Button>
                    ) : null
                  }
                  previewBlocked={hasUnsavedChanges}
                  onPreviewBlocked={() => {
                    toast.error('Please save your changes first, then open preview.');
                  }}
                  fullHeight
                />
              )}
            />
            <FieldError message={form.formState.errors.body?.message} />
          </div>

          {isNameStepOpen ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4">
              <Card className="w-full max-w-xl border-slate-300 bg-white text-slate-900">
                <CardContent className="space-y-4 p-6">
                  <h3 className="text-lg font-semibold">Template Details</h3>
                  <p className="text-sm text-slate-600">
                    Enter template name, then save to add this template in All Templates.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="template-name-final">Template Name</Label>
                    <Input
                      id="template-name-final"
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      placeholder="Enter template name"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsNameStepOpen(false)}
                      disabled={isFinalSaving}
                    >
                      Back
                    </Button>
                    <Button type="button" onClick={() => void handleFinalSave()} disabled={isFinalSaving}>
                      {isFinalSaving ? 'Saving...' : 'Save Template'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
