'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface EmailTemplateHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  fullHeight?: boolean;
  showHelpText?: boolean;
}

export function EmailTemplateHtmlEditor({
  value,
  onChange,
  fullHeight = false,
  showHelpText = true,
}: EmailTemplateHtmlEditorProps) {
  const [activeView, setActiveView] = useState<'code' | 'preview'>('code');

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

  if (fullHeight) {
    return (
      <div className="html-editor-shell flex h-full min-h-[68vh] flex-1 flex-col gap-3 rounded-md border border-zinc-300 bg-white p-3 text-black">
        {showHelpText ? (
          <div className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs text-black">
            Use inline CSS for best compatibility across email clients. Avoid JavaScript and iframe
            tags.
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2">
          <section className="flex min-h-[62vh] flex-col overflow-hidden rounded-md border border-zinc-300 bg-white">
            <div className="border-b border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-semibold text-black">
              Code Editor
            </div>
            <textarea
              rows={1}
              className="h-full min-h-[58vh] flex-1 resize-none bg-white px-3 py-2 font-mono text-sm text-black caret-black outline-none"
              placeholder="<!doctype html><html><body>...</body></html>"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          </section>

          <section className="flex min-h-[62vh] flex-col overflow-hidden rounded-md border border-zinc-300 bg-white">
            <div className="border-b border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-semibold text-black">
              Live Preview
            </div>
            <iframe
              title="HTML template live preview"
              className="h-full min-h-[58vh] w-full flex-1 bg-white"
              sandbox=""
              srcDoc={previewDocument}
            />
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
      </div>
    );
  }

  return (
    <div className="html-editor-shell space-y-3 rounded-md border border-zinc-300 bg-white p-3 text-black">
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

      {showHelpText ? (
        <div className="rounded-md border border-zinc-300 bg-zinc-100 p-3 text-xs text-black">
          Use inline CSS for best compatibility across email clients. Avoid JavaScript and iframe
          tags.
        </div>
      ) : null}

      {activeView === 'code' ? (
        <textarea
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
    </div>
  );
}
