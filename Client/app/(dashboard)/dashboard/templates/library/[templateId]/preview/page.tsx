'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pencil, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HttpClientError } from '@/lib/api/errors';
import { createTemplate, getMjmlProviderTemplateById } from '@/lib/api/templates';
import {
  clearLibraryTemplateDraft,
  readLibraryTemplateDraft,
} from '@/lib/templates/library-template-draft';
import type { ProviderTemplateDetail } from '@/lib/types/template';

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Failed to load template preview.';
}

function toPreviewDocument(html: string): string {
  if (/<html[\s>]/i.test(html)) {
    return html;
  }

  return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${html}</body></html>`;
}

export default function TemplatePreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ templateId: string }>();
  const templateId = decodeURIComponent(params.templateId);
  const [template, setTemplate] = useState<ProviderTemplateDetail | null>(null);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftHtml, setDraftHtml] = useState<string | null>(null);
  const [isFinalSaving, setIsFinalSaving] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(960);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const isChangesPreview = searchParams.get('changes') === '1';
  const hasDraft = Boolean(draftHtml);

  const previewTitle = useMemo(() => {
    if (hasDraft && draftName) {
      return draftName;
    }

    return template?.name ?? '';
  }, [draftName, hasDraft, template?.name]);

  const previewHtml = useMemo(() => {
    if (hasDraft && draftHtml) {
      return draftHtml;
    }

    return template?.html ?? '';
  }, [draftHtml, hasDraft, template?.html]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      setIsLoading(true);
      setError(null);
      try {
        const detail = await getMjmlProviderTemplateById(templateId);
        if (!cancelled) {
          setTemplate(detail);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setTemplate(null);
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
  }, [templateId]);

  useEffect(() => {
    if (!isChangesPreview) {
      setDraftName(null);
      setDraftHtml(null);
      return;
    }

    const draft = readLibraryTemplateDraft(templateId);
    if (!draft) {
      setDraftName(null);
      setDraftHtml(null);
      return;
    }

    setDraftName(draft.name);
    setDraftHtml(draft.body);
  }, [isChangesPreview, templateId]);

  const handleResizeIframe = () => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }

    const doc = iframe.contentDocument;
    if (!doc) {
      return;
    }

    const bodyHeight = doc.body?.scrollHeight ?? 0;
    const htmlHeight = doc.documentElement?.scrollHeight ?? 0;
    const height = Math.max(bodyHeight, htmlHeight, 960);
    setIframeHeight(height + 12);
  };

  const handleSaveTemplate = async () => {
    const draft = readLibraryTemplateDraft(templateId);
    if (!draft) {
      toast.error('No draft changes found. Please edit and save your template first.');
      return;
    }

    setIsFinalSaving(true);
    try {
      await createTemplate(draft);
      clearLibraryTemplateDraft(templateId);
      toast.success('Template saved successfully.');
      router.push('/dashboard/templates');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsFinalSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
          <Link
            href={
              isChangesPreview
                ? `/dashboard/templates/library/${encodeURIComponent(templateId)}/use`
                : '/dashboard/templates'
            }
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        {!isChangesPreview ? (
          <Button asChild>
            <Link href={`/dashboard/templates/library/${encodeURIComponent(templateId)}/use`}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Link>
          </Button>
        ) : null}
        {isChangesPreview ? (
          <Button onClick={() => void handleSaveTemplate()} disabled={isFinalSaving || isLoading || !hasDraft}>
            <Save className="mr-1 h-4 w-4" />
            {isFinalSaving ? 'Saving...' : 'Save Template'}
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
          <CardContent className="py-10 text-sm text-zinc-400">Loading template...</CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-rose-800/40 bg-rose-900/20 text-rose-100">
          <CardContent className="py-8 text-sm">{error}</CardContent>
        </Card>
      ) : null}

      {previewHtml ? (
        <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
          <CardContent className="p-4">
            <iframe
              ref={iframeRef}
              title={`${previewTitle} preview`}
              className="w-full rounded-md border border-zinc-800 bg-white"
              style={{ height: `${iframeHeight}px` }}
              sandbox="allow-same-origin"
              srcDoc={toPreviewDocument(previewHtml)}
              onLoad={handleResizeIframe}
            />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
