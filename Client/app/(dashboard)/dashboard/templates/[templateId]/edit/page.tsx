'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { EmailTemplateHtmlEditor } from '@/components/templates/email-template-html-editor';
import { LayoutTemplateEditor } from '@/components/templates/layout-template-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { HttpClientError } from '@/lib/api/errors';
import { getTemplateById, updateTemplate } from '@/lib/api/templates';
import { cn } from '@/lib/utils';
import type {
  MarketingTemplate,
  TemplateType,
} from '@/lib/types/template';
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

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-rose-500">{message}</p>;
}

function getDefaultValues(
  template: MarketingTemplate | null | undefined,
  defaultType: TemplateType,
): TemplateFormValues {
  return {
    type: template?.type ?? defaultType,
    editorType: template?.editorType ?? 'html',
    layoutPreset: template?.layoutPreset ?? null,
    designJson: template?.designJson ?? null,
    mjmlBody: template?.mjmlBody ?? null,
    category: template?.category ?? 'general',
    name: template?.name ?? '',
    subject: template?.subject ?? '',
    body: template?.body ?? '',
    status: template?.status ?? 'active',
  };
}

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams<{ templateId: string }>();
  const templateId = useMemo(() => decodeURIComponent(params.templateId ?? ''), [params.templateId]);

  const [template, setTemplate] = useState<MarketingTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema) as never,
    defaultValues: getDefaultValues(template, 'email'),
  });

  useEffect(() => {
    form.register('designJson');
    form.register('mjmlBody');
    form.register('name');
    form.register('subject');
  }, [form]);

  useEffect(() => {
    if (!templateId) {
      setIsLoading(false);
      setLoadError('Invalid template id.');
      return;
    }

    let cancelled = false;

    async function loadTemplate() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const item = await getTemplateById(templateId);
        if (!cancelled) {
          setTemplate(item);
          form.reset(getDefaultValues(item, item.type));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setTemplate(null);
          setLoadError(getErrorMessage(error));
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

  const watchedType = useWatch({ control: form.control, name: 'type' }) ?? 'email';
  const watchedEditorType = useWatch({ control: form.control, name: 'editorType' }) ?? 'html';
  const watchedLayoutPreset = useWatch({ control: form.control, name: 'layoutPreset' });
  const watchedDesignJson = useWatch({ control: form.control, name: 'designJson' });
  const watchedMjmlBody = useWatch({ control: form.control, name: 'mjmlBody' }) ?? null;
  const useFullPageEditor = !isLoading && !loadError && watchedType === 'email';

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!template) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTemplate(template.id, values);
      toast.success('Template updated successfully.');
      router.push('/dashboard/templates');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <section
      className={cn(
        useFullPageEditor
          ? 'flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden p-3 md:p-4'
          : 'mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8',
      )}
    >
      {isLoading ? (
        <Skeleton className="h-[60vh] min-h-[420px] w-full rounded-md" />
      ) : loadError ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
          {loadError}
        </div>
      ) : (
        <form className={cn(useFullPageEditor ? 'flex h-full min-h-0 flex-col gap-3 overflow-hidden' : 'space-y-4')} onSubmit={handleSubmit}>
          <input type="hidden" {...form.register('type')} />
          <input type="hidden" {...form.register('editorType')} />
          <input type="hidden" {...form.register('category')} />
          <input type="hidden" {...form.register('status')} />
          <input type="hidden" {...form.register('layoutPreset')} />

          {useFullPageEditor ? (
            <>
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden space-y-2">
                {watchedEditorType === 'layout' ? (
                  <Controller
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <LayoutTemplateEditor
                        key={`layout-editor-${template?.id ?? `preset-${watchedLayoutPreset ?? 'none'}`}`}
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
                        headerActions={(
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 border-[#1d718d] bg-[#0f5b76] px-3 text-xs font-semibold text-white hover:bg-[#0c6784] hover:text-white"
                              onClick={() =>
                                router.push(
                                  template
                                    ? `/dashboard/templates/${encodeURIComponent(template.id)}`
                                    : '/dashboard/templates',
                                )
                              }
                              disabled={isSubmitting}
                            >
                              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                              Back
                            </Button>
                            <Button
                              type="submit"
                              className="h-8 bg-white px-3 text-xs font-semibold text-[#0a4f68] hover:bg-slate-100"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? 'Saving...' : 'Save'}
                            </Button>
                          </>
                        )}
                        fullHeight
                      />
                    )}
                  />
                ) : (
                  <Controller
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <EmailTemplateHtmlEditor
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        headerActions={(
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100"
                              onClick={() =>
                                router.push(
                                  template
                                    ? `/dashboard/templates/${encodeURIComponent(template.id)}`
                                    : '/dashboard/templates',
                                )
                              }
                              disabled={isSubmitting}
                            >
                              <ArrowLeft className="mr-1 h-4 w-4" />
                              Back
                            </Button>
                            <Button type="submit" className="h-8" disabled={isSubmitting}>
                              {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                          </>
                        )}
                        fullHeight
                      />
                    )}
                  />
                )}
                <FieldError message={form.formState.errors.body?.message} />
              </div>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Edit Template</CardTitle>
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

                <textarea
                  id="body"
                  rows={8}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Hi {{name}}, we have a new update for {{company}}."
                  {...form.register('body')}
                />
                <FieldError message={form.formState.errors.body?.message} />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-300"
                    onClick={() =>
                      router.push(
                        template
                          ? `/dashboard/templates/${encodeURIComponent(template.id)}`
                          : '/dashboard/templates',
                      )
                    }
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      )}
    </section>
  );
}
