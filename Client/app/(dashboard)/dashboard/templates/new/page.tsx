'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { EmailTemplateHtmlEditor } from '@/components/templates/email-template-html-editor';
import { LayoutTemplateEditor } from '@/components/templates/layout-template-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLayoutEditorFlow, useLayoutEditorScrollLock } from '@/hooks/use-layout-editor-flow';
import { HttpClientError } from '@/lib/api/errors';
import { createTemplate } from '@/lib/api/templates';
import { getLayoutPresetDefinition } from '@/lib/constants/template-layouts';
import type { TemplateLayoutPreset } from '@/lib/types/template';
import { cn } from '@/lib/utils';
import { templateFormSchema, type TemplateFormValues } from '@/lib/validators/template';

const PREBUILT_LAYOUT_PRESETS: TemplateLayoutPreset[] = [
  'basic',
  'commerce',
  'three-columns',
  'news',
  'text',
];

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

  return <p className="text-xs text-rose-500">{message}</p>;
}

function getDefaultValues(
  editor: 'html' | 'layout',
  preset: TemplateLayoutPreset | null,
): TemplateFormValues {
  if (editor === 'layout') {
    const starter = getLayoutPresetDefinition(preset ?? 'basic');
    return {
      type: 'email',
      editorType: 'layout',
      layoutPreset: starter.id,
      designJson: null,
      mjmlBody: starter.starterMjml,
      category: 'general',
      name: '',
      subject: starter.starterSubject,
      body: starter.starterHtml,
      status: 'active',
    };
  }

  return {
    type: 'email',
    editorType: 'html',
    layoutPreset: null,
    designJson: null,
    mjmlBody: null,
    category: 'general',
    name: '',
    subject: 'Hello {{name}}, your offer is ready',
    body: '<!doctype html><html><body>...</body></html>',
    status: 'active',
  };
}

export default function NewTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const editorMode = useMemo<'html' | 'layout'>(() => {
    const raw = searchParams.get('editor');
    return raw === 'layout' ? 'layout' : 'html';
  }, [searchParams]);

  const layoutPreset = useMemo<TemplateLayoutPreset | null>(() => {
    const raw = searchParams.get('preset')?.trim();
    if (!raw) {
      return null;
    }

    return PREBUILT_LAYOUT_PRESETS.includes(raw as TemplateLayoutPreset)
      ? (raw as TemplateLayoutPreset)
      : null;
  }, [searchParams]);

  const isLayoutNewFlow = editorMode === 'layout';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isFinalSaving, setIsFinalSaving] = useState(false);
  const [editorOpened, setEditorOpened] = useState(false);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema) as never,
    defaultValues: getDefaultValues(editorMode, layoutPreset),
  });

  const {
    clearDraftProgress,
    closeNameStep,
    finalizedName,
    isDraftSaved,
    isNameStepOpen,
    markDraftSaved,
    openNameStep,
    resetFlow,
    setTemplateName,
    syncTemplateName,
    templateName,
  } = useLayoutEditorFlow({ initialTemplateName: '' });

  useEffect(() => {
    form.register('designJson');
    form.register('mjmlBody');
  }, [form]);

  useEffect(() => {
    const defaults = getDefaultValues(editorMode, layoutPreset);
    form.reset(defaults);
    resetFlow(defaults.name ?? '');
    setEditorOpened(false);
  }, [editorMode, form, layoutPreset, resetFlow]);

  useLayoutEditorScrollLock(isLayoutNewFlow);

  const watchedType = useWatch({ control: form.control, name: 'type' }) ?? 'email';
  const watchedEditorType = useWatch({ control: form.control, name: 'editorType' }) ?? editorMode;
  const watchedLayoutPreset = useWatch({ control: form.control, name: 'layoutPreset' });
  const watchedDesignJson = useWatch({ control: form.control, name: 'designJson' });
  const watchedMjmlBody = useWatch({ control: form.control, name: 'mjmlBody' }) ?? null;
  const watchedName = useWatch({ control: form.control, name: 'name' }) ?? '';
  const watchedSubject = useWatch({ control: form.control, name: 'subject' }) ?? '';
  const canOpenEditor = watchedName.trim().length > 0 && watchedSubject.trim().length > 0;
  const hasUnsavedChanges = form.formState.isDirty;
  const canGoNext = isDraftSaved && !hasUnsavedChanges;

  useEffect(() => {
    syncTemplateName(watchedName);
  }, [syncTemplateName, watchedName]);

  useEffect(() => {
    if (hasUnsavedChanges) {
      clearDraftProgress();
    }
  }, [clearDraftProgress, hasUnsavedChanges]);

  const openEditor = async () => {
    const valid = await form.trigger(['name', 'subject']);
    if (!valid) {
      return;
    }
    setEditorOpened(true);
  };

  const handleDraftSave = async () => {
    const valid = await form.trigger(['subject', 'body']);
    if (!valid) {
      toast.error('Please complete required fields before saving.');
      return;
    }

    setIsSavingDraft(true);
    try {
      const values = form.getValues();
      form.reset(values);
      markDraftSaved();
      toast.success('Changes saved.');
    } finally {
      setIsSavingDraft(false);
    }
  };

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
      toast.success('Template created successfully.');
      router.push('/dashboard/templates');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsFinalSaving(false);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      await createTemplate(values);
      toast.success('Template created successfully.');
      router.push('/dashboard/templates');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  });

  if (isLayoutNewFlow) {
    return (
      <section className="relative h-full w-full overflow-hidden">
        <form
          id="template-editor-form"
          className="flex h-full min-h-0 w-full flex-col"
          onSubmit={(event) => event.preventDefault()}
        >
          <input type="hidden" {...form.register('type')} />
          <input type="hidden" {...form.register('editorType')} />
          <input type="hidden" {...form.register('category')} />
          <input type="hidden" {...form.register('status')} />
          <input type="hidden" {...form.register('layoutPreset')} />

          <div className="flex h-full min-h-0 w-full flex-col">
            {watchedType === 'email' && watchedEditorType === 'layout' ? (
              <Controller
                control={form.control}
                name="body"
                render={({ field }) => (
                  <LayoutTemplateEditor
                    key={`layout-editor-new-${watchedLayoutPreset ?? 'none'}`}
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
                    mjmlValue={watchedMjmlBody}
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
                          onClick={() => router.push('/dashboard/templates')}
                        >
                          <ArrowLeft className="mr-1 h-4 w-4" />
                          Back
                        </Button>
                        <Button
                          type="button"
                          className="bg-white text-[#0b5066] hover:bg-cyan-50"
                          onClick={() => void handleDraftSave()}
                          disabled={isSavingDraft || isFinalSaving || !hasUnsavedChanges}
                        >
                          <Save className="mr-1 h-4 w-4" />
                          {isSavingDraft ? 'Saving...' : 'Save'}
                        </Button>
                        {canGoNext ? (
                          <Button
                            type="button"
                            className="bg-cyan-100 text-[#0b5066] hover:bg-cyan-200"
                            onClick={openNameStep}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Next
                          </Button>
                        ) : null}
                      </>
                    }
                    previewBlocked={hasUnsavedChanges}
                    onPreviewBlocked={() => {
                      toast.error('Please save your changes first, then open preview.');
                    }}
                    fullHeight
                  />
                )}
              />
            ) : null}
            <FieldError message={form.formState.errors.body?.message} />
          </div>

          {isNameStepOpen ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4">
              <Card className="w-full max-w-xl border-slate-300 bg-white text-slate-900">
                <CardContent className="space-y-4 p-6">
                  <h3 className="text-lg font-semibold">Template Name</h3>
                  <p className="text-sm text-slate-600">
                    Enter template name, then save to add this template in All Templates.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="template-name-final">Template Name</Label>
                    <Input
                      id="template-name-final"
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      placeholder="Welcome Sequence V1"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={closeNameStep} disabled={isFinalSaving}>
                      Back
                    </Button>
                    <Button type="button" onClick={() => void handleFinalSave()} disabled={isFinalSaving}>
                      {isFinalSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </form>
      </section>
    );
  }

  return (
    <section
      className={cn(
        editorOpened
          ? 'flex min-h-[calc(100vh-5rem)] w-full flex-col gap-4 p-3 md:p-6'
          : 'mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8',
      )}
    >
      <form className={cn(editorOpened ? 'flex h-full min-h-0 flex-col gap-4' : 'space-y-5')} onSubmit={handleSubmit}>
        <input type="hidden" {...form.register('type')} />
        <input type="hidden" {...form.register('editorType')} />
        <input type="hidden" {...form.register('category')} />
        <input type="hidden" {...form.register('status')} />
        <input type="hidden" {...form.register('layoutPreset')} />

        {!editorOpened ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-300"
                onClick={() => router.push('/dashboard/templates')}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Create New Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input id="name" placeholder="Welcome Sequence V1" {...form.register('name')} />
                    <FieldError message={form.formState.errors.name?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="Hello {{name}}, your offer is ready"
                      {...form.register('subject')}
                    />
                    <FieldError message={form.formState.errors.subject?.message} />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-300"
                    onClick={() => router.push('/dashboard/templates')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  {canOpenEditor ? (
                    <Button type="button" onClick={() => void openEditor()} disabled={isSubmitting}>
                      Next
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-wrap justify-end gap-2 p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-300"
                  onClick={() => setEditorOpened(false)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Create Template'}
                </Button>
              </CardContent>
            </Card>

            <div className="flex flex-1 min-h-0 flex-col space-y-2">
              {watchedType === 'email' ? (
                watchedEditorType === 'layout' ? (
                  <Controller
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <LayoutTemplateEditor
                        key={`layout-editor-new-${watchedLayoutPreset ?? 'none'}`}
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
                        mjmlValue={watchedMjmlBody}
                        onMjmlChange={(mjml) => {
                          form.setValue('mjmlBody', mjml, {
                            shouldDirty: true,
                          });
                        }}
                        fullHeight
                      />
                    )}
                  />
                ) : (
                  <Controller
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <EmailTemplateHtmlEditor value={field.value ?? ''} onChange={field.onChange} fullHeight />
                    )}
                  />
                )
              ) : (
                <textarea
                  id="body"
                  rows={8}
                  className="h-full min-h-[420px] w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Hi {{name}}, we have a new update for {{company}}."
                  {...form.register('body')}
                />
              )}
              <FieldError message={form.formState.errors.body?.message} />
            </div>
          </>
        )}
      </form>
    </section>
  );
}
