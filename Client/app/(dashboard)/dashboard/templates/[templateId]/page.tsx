'use client';

import { ArrowLeft, Edit3, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
    <section className="flex h-full min-h-0 flex-col bg-zinc-100 text-zinc-900">
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-zinc-300 text-zinc-900 hover:bg-zinc-100"
            onClick={() => router.push('/dashboard/templates')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>

          <div className="flex flex-wrap items-center gap-2">
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
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting || !template}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isLoading ? (
          <div className="h-full w-full p-4 md:p-6">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : loadError ? (
          <div className="flex h-full w-full items-center justify-center p-6">
            <div className="w-full max-w-3xl rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
              {loadError}
            </div>
          </div>
        ) : template ? (
          <iframe
            title={`${template.name} preview`}
            className="block h-full w-full border-0 bg-white"
            sandbox=""
            srcDoc={toPreviewDocument(template.body)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-6">
            <div className="rounded-md border border-zinc-300 bg-white p-4 text-sm text-zinc-700">
              Template not found.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
