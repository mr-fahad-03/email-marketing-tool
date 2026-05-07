'use client';

import { ArrowLeft, Edit3, Eye, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HttpClientError } from '@/lib/api/errors';
import {
  deleteTemplate,
  getTemplateById,
} from '@/lib/api/templates';
import type { MarketingTemplate } from '@/lib/types/template';

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

function toPreviewDocument(html: string): string {
  if (/<html[\s>]/i.test(html)) {
    return html;
  }

  return `<!doctype html><html><head><meta charset="utf-8" /><style>body{margin:0;padding:0;}</style></head><body>${html}</body></html>`;
}

export default function TemplateDetailsPage() {
  const router = useRouter();
  const params = useParams<{ templateId: string }>();
  const templateId = useMemo(() => decodeURIComponent(params.templateId ?? ''), [params.templateId]);

  const [template, setTemplate] = useState<MarketingTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

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
  }, [templateId]);

  const handleDelete = async () => {
    if (!template) {
      return;
    }

    const confirmed = window.confirm(`Delete "${template.name}" template?`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteTemplate(template.id);
      toast.success('Template deleted successfully.');
      router.push('/dashboard/templates');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          onClick={() => router.push('/dashboard/templates')}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={isDeleting || !template}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!template) {
                return;
              }
              router.push(`/dashboard/templates/${encodeURIComponent(template.id)}/edit`);
            }}
            disabled={!template}
          >
            <Edit3 className="mr-1 h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            onClick={() => {
              if (!template) {
                return;
              }
              router.push(`/dashboard/templates/${encodeURIComponent(template.id)}`);
            }}
            disabled={!template}
          >
            <Eye className="mr-1 h-4 w-4" />
            Preview
          </Button>
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">Template</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[70vh] min-h-[420px] w-full rounded-md" />
          ) : loadError ? (
            <div className="rounded-md border border-rose-800/50 bg-rose-900/20 p-4 text-sm text-rose-200">
              {loadError}
            </div>
          ) : template ? (
            <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-md border border-zinc-800 bg-white">
              <iframe
                title={`${template.name} image preview`}
                className="h-full w-full"
                sandbox=""
                srcDoc={toPreviewDocument(template.body)}
              />
            </div>
          ) : (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
              Template not found.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
