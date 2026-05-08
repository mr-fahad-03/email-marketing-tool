'use client';

import { Laptop, ImagePlus, Smartphone } from 'lucide-react';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { TemplateImagePickerDialog } from '@/components/templates/template-image-picker-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmailTemplateHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  headerActions?: ReactNode;
  fullHeight?: boolean;
}

export function EmailTemplateHtmlEditor({
  value,
  onChange,
  headerActions,
  fullHeight = false,
}: EmailTemplateHtmlEditorProps) {
  const [activeView, setActiveView] = useState<'code' | 'preview'>('code');
  const [viewMode, setViewMode] = useState<'code' | 'desktop' | 'mobile'>('code');
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const fullHeightTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const compactTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const previewDocument = useMemo(() => {
    const source = value.trim();
    if (!source) {
      return '<!doctype html><html><head><meta charset="utf-8" /></head><body style="font-family:Arial,sans-serif;color:#111827;padding:20px;background:#ffffff;">Start writing or paste HTML on the left to preview it here in real time.</body></html>';
    }

    if (/<html[\s>]/i.test(source)) {
      return source;
    }

    return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${source}</body></html>`;
  }, [value]);

  const handleInsertImage = (url: string) => {
    const imageSnippet = `<img src="${url}" alt="" style="max-width:100%;height:auto;" />`;
    const activeTextarea = fullHeight
      ? fullHeightTextareaRef.current
      : activeView === 'code'
        ? compactTextareaRef.current
        : null;

    if (!activeTextarea) {
      const nextValue = value.trim().length > 0 ? `${value}\n${imageSnippet}` : imageSnippet;
      onChange(nextValue);
      return;
    }

    const selectionStart = activeTextarea.selectionStart ?? value.length;
    const selectionEnd = activeTextarea.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, selectionStart)}${imageSnippet}${value.slice(selectionEnd)}`;

    onChange(nextValue);

    requestAnimationFrame(() => {
      activeTextarea.focus();
      const cursor = selectionStart + imageSnippet.length;
      activeTextarea.setSelectionRange(cursor, cursor);
    });
  };

  if (fullHeight) {
    const isCodeMode = viewMode === 'code';
    const isMobilePreviewMode = viewMode === 'mobile';

    return (
      <div className="html-editor-shell flex h-full min-h-[68vh] flex-1 flex-col gap-3 bg-white p-3 text-black">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5">
          <div className="flex items-center gap-2">{headerActions}</div>
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                'inline-flex h-8 min-w-[74px] items-center justify-center rounded-md border px-3 text-xs font-semibold whitespace-nowrap',
                isCodeMode
                  ? 'border-black bg-black text-white'
                  : 'border-zinc-300 bg-white text-black hover:bg-zinc-100',
              )}
              onClick={() => setViewMode('code')}
            >
              Code
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex h-8 min-w-[86px] items-center justify-center gap-1 rounded-md border px-3 text-xs font-semibold whitespace-nowrap',
                viewMode === 'desktop'
                  ? 'border-black bg-black text-white'
                  : 'border-zinc-300 bg-white text-black hover:bg-zinc-100',
              )}
              onClick={() => setViewMode('desktop')}
            >
              <Laptop className="h-3.5 w-3.5" />
              Desktop
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex h-8 min-w-[80px] items-center justify-center gap-1 rounded-md border px-3 text-xs font-semibold whitespace-nowrap',
                viewMode === 'mobile'
                  ? 'border-black bg-black text-white'
                  : 'border-zinc-300 bg-white text-black hover:bg-zinc-100',
              )}
              onClick={() => setViewMode('mobile')}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobile
            </button>
            <Button
              type="button"
              variant="outline"
              className="h-8 border-zinc-300 text-zinc-800 hover:bg-zinc-100"
              onClick={() => setIsImagePickerOpen(true)}
            >
              <ImagePlus className="h-4 w-4" />
              Insert Image
            </Button>
          </div>
        </div>

        <div className={cn('grid min-h-0 flex-1 gap-3', isCodeMode ? 'md:grid-cols-2' : 'grid-cols-1')}>
          {isCodeMode ? (
            <section className="flex min-h-[62vh] flex-col overflow-hidden rounded-md border border-zinc-300 bg-white">
              <textarea
                ref={fullHeightTextareaRef}
                rows={1}
                className="h-full min-h-[58vh] flex-1 resize-none bg-white px-3 py-2 font-mono text-sm text-black caret-black outline-none"
                placeholder="<!doctype html><html><body>...</body></html>"
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
            </section>
          ) : null}

          <section className="flex min-h-[62vh] flex-col overflow-hidden rounded-md border border-zinc-300 bg-white">
            <div className="border-b border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-black">
              Live Preview
            </div>
            <div className="flex h-full min-h-[58vh] flex-1 items-start justify-center overflow-auto bg-white p-2">
              <div
                className={cn(
                  'h-full min-h-[58vh] overflow-hidden border border-zinc-300 bg-white shadow-sm transition-all',
                  isMobilePreviewMode ? 'w-[375px] max-w-full' : 'w-full',
                )}
              >
                <iframe
                  title="HTML template live preview"
                  className="h-full min-h-[58vh] w-full bg-white"
                  sandbox=""
                  srcDoc={previewDocument}
                />
              </div>
            </div>
          </section>
        </div>

        <style jsx>{`
          .html-editor-shell textarea {
            color: #111827 !important;
            -webkit-text-fill-color: #111827 !important;
          }

          .html-editor-shell textarea::placeholder {
            color: #374151 !important;
            opacity: 1 !important;
          }
        `}</style>

        <TemplateImagePickerDialog
          open={isImagePickerOpen}
          onOpenChange={setIsImagePickerOpen}
          onSelectImage={(imageUrl) => handleInsertImage(imageUrl)}
        />
      </div>
    );
  }

  return (
    <div className="html-editor-shell space-y-3 rounded-md border border-zinc-300 bg-white p-3 text-black">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-zinc-900 bg-zinc-900 p-1">
          <button
            type="button"
            className={cn(
              'rounded px-3 py-1.5 text-xs font-medium transition',
              activeView === 'code' ? 'bg-white text-black' : 'text-white hover:bg-zinc-800',
            )}
            onClick={() => setActiveView('code')}
          >
            Code
          </button>
          <button
            type="button"
            className={cn(
              'rounded px-3 py-1.5 text-xs font-medium transition',
              activeView === 'preview' ? 'bg-white text-black' : 'text-white hover:bg-zinc-800',
            )}
            onClick={() => setActiveView('preview')}
          >
            Preview
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          onClick={() => setIsImagePickerOpen(true)}
        >
          <ImagePlus className="h-4 w-4" />
          Insert Image
        </Button>
      </div>

      {activeView === 'code' ? (
        <textarea
          ref={compactTextareaRef}
          rows={16}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-black caret-black"
          placeholder="<!doctype html><html><body>...</body></html>"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <iframe
          title="HTML template preview"
          className="h-[62vh] min-h-[420px] w-full rounded-md border border-zinc-300 bg-white"
          sandbox=""
          srcDoc={previewDocument}
        />
      )}

      <style jsx>{`
        .html-editor-shell textarea {
          color: #111827 !important;
          -webkit-text-fill-color: #111827 !important;
        }

        .html-editor-shell textarea::placeholder {
          color: #374151 !important;
          opacity: 1 !important;
        }
      `}</style>

      <TemplateImagePickerDialog
        open={isImagePickerOpen}
        onOpenChange={setIsImagePickerOpen}
        onSelectImage={(imageUrl) => handleInsertImage(imageUrl)}
      />
    </div>
  );
}
