import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTemplateCategoryLabel } from '@/lib/constants/template-categories';
import type { TemplateLibraryItem } from '@/lib/constants/email-template-library';

interface TemplateLibraryGridProps {
  items: TemplateLibraryItem[];
  onPreviewTemplate: (item: TemplateLibraryItem) => void;
}

function summarizeTemplateBody(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 130);
}

function toSummary(item: TemplateLibraryItem): string {
  if (item.summary?.trim()) {
    return item.summary.trim().slice(0, 130);
  }

  return summarizeTemplateBody(item.body);
}

function toPreviewDocument(html: string): string {
  if (/<html[\s>]/i.test(html)) {
    return html;
  }

  return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${html}</body></html>`;
}

export function TemplateLibraryGrid({
  items,
  onPreviewTemplate,
}: TemplateLibraryGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-10 text-center">
        <p className="text-sm text-zinc-300">No templates found in library.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.id}
          role="button"
          tabIndex={0}
          aria-label={`Open template ${item.name}`}
          className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:outline-none"
          onClick={() => onPreviewTemplate(item)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onPreviewTemplate(item);
            }
          }}
        >
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{getTemplateCategoryLabel(item.category)}</span>
          </div>
          <div className="mb-3 h-48 overflow-hidden rounded-md border border-zinc-800 bg-white">
            {item.previewImageUrl ? (
              <img
                src={item.previewImageUrl}
                alt={`${item.name} preview`}
                className="h-full w-full object-cover object-top"
                loading="lazy"
              />
            ) : (
              <div className="h-[200%] w-[200%] origin-top-left scale-50">
                <iframe
                  title={`${item.name} preview`}
                  className="h-full w-full pointer-events-none"
                  sandbox=""
                  srcDoc={toPreviewDocument(item.body)}
                />
              </div>
            )}
          </div>
          <h3 className="line-clamp-1 text-sm font-semibold text-zinc-100">{item.name}</h3>
          <p className="mt-2 text-xs text-zinc-500">{toSummary(item)}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              {item.editorType === 'layout' ? 'Layout editor' : 'HTML editor'}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onPreviewTemplate(item);
              }}
            >
              Preview
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
