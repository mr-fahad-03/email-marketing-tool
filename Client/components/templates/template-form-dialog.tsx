'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { EmailTemplateHtmlEditor } from '@/components/templates/email-template-html-editor';
import { LayoutTemplateEditor } from '@/components/templates/layout-template-editor';
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
import type {
  MarketingTemplate,
  TemplateEditorType,
  TemplateLayoutPreset,
  TemplateType,
} from '@/lib/types/template';
import { templateFormSchema, type TemplateFormValues } from '@/lib/validators/template';

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MarketingTemplate | null;
  defaultType: TemplateType;
  creationPreset?: {
    editorType: TemplateEditorType;
    layoutPreset: TemplateLayoutPreset | null;
    designJson?: MarketingTemplate['designJson'];
    mjmlBody?: string | null;
    category?: MarketingTemplate['category'];
    name?: string;
    subject?: string;
    body?: string;
  } | null;
  isSubmitting?: boolean;
  onSubmit: (values: TemplateFormValues) => Promise<void>;
}

function getDefaultValues(
  template: MarketingTemplate | null | undefined,
  defaultType: TemplateType,
  creationPreset?: TemplateFormDialogProps['creationPreset'],
): TemplateFormValues {
  return {
    type: template?.type ?? defaultType,
    editorType: template?.editorType ?? creationPreset?.editorType ?? 'html',
    layoutPreset: template?.layoutPreset ?? creationPreset?.layoutPreset ?? null,
    designJson: template?.designJson ?? creationPreset?.designJson ?? null,
    mjmlBody: template?.mjmlBody ?? creationPreset?.mjmlBody ?? null,
    category: template?.category ?? creationPreset?.category ?? 'general',
    name: template?.name ?? creationPreset?.name ?? '',
    subject: template?.subject ?? creationPreset?.subject ?? '',
    body: template?.body ?? creationPreset?.body ?? '',
    status: template?.status ?? 'active',
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-rose-400">{message}</p>;
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  defaultType,
  creationPreset,
  isSubmitting = false,
  onSubmit,
}: TemplateFormDialogProps) {
  const isEdit = Boolean(template);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema) as never,
    defaultValues: getDefaultValues(template, defaultType, creationPreset),
  });

  useEffect(() => {
    form.register('designJson');
    form.register('mjmlBody');
  }, [form]);

  useEffect(() => {
    form.reset(getDefaultValues(template, defaultType, creationPreset));
  }, [creationPreset, defaultType, form, open, template]);

  const watchedType = useWatch({
    control: form.control,
    name: 'type',
  }) ?? defaultType;

  const watchedEditorType = useWatch({
    control: form.control,
    name: 'editorType',
  }) ?? 'html';

  const watchedLayoutPreset = useWatch({
    control: form.control,
    name: 'layoutPreset',
  });

  const watchedDesignJson = useWatch({
    control: form.control,
    name: 'designJson',
  });

  const watchedMjmlBody = useWatch({
    control: form.control,
    name: 'mjmlBody',
  }) ?? null;

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-[1200px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Template' : 'Create New Template'}</DialogTitle>
          <DialogDescription>
            Save reusable templates in your personal section and use them in campaigns.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input type="hidden" {...form.register('type')} />
          <input type="hidden" {...form.register('editorType')} />
          <input type="hidden" {...form.register('category')} />
          <input type="hidden" {...form.register('status')} />
          <input type="hidden" {...form.register('layoutPreset')} />

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="Welcome Sequence V1"
                {...form.register('name')}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
                placeholder="Hello {{name}}, your offer is ready"
                {...form.register('subject')}
              />
              <FieldError message={form.formState.errors.subject?.message} />
            </div>
          </div>

          <div className="space-y-2">
            {watchedType === 'email' ? (
              watchedEditorType === 'layout' ? (
                <Controller
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <LayoutTemplateEditor
                      key={`layout-editor-${isEdit ? template?.id ?? 'unknown' : `preset-${watchedLayoutPreset ?? 'none'}`}`}
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
                    />
                  )}
                />
              )
            ) : (
              <textarea
                id="body"
                rows={8}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="Hi {{name}}, we have a new update for {{company}}."
                {...form.register('body')}
              />
            )}
            <FieldError message={form.formState.errors.body?.message} />
          </div>

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
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
