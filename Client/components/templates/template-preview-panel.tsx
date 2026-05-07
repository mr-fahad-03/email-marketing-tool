import { useMemo } from 'react';
import {
  extractTemplateVariablesFromParts,
  renderTemplateWithSampleData,
} from '@/lib/template-utils';
import type { TemplateType } from '@/lib/types/template';

interface TemplatePreviewPanelProps {
  type: TemplateType;
  subject: string;
  body: string;
}

export function TemplatePreviewPanel({ type, subject, body }: TemplatePreviewPanelProps) {
  const variables = extractTemplateVariablesFromParts([subject, body]);
  const previewSubject = renderTemplateWithSampleData(subject || '(no subject)');
  const previewBody = renderTemplateWithSampleData(body || '(no body)');
  const previewDocument = useMemo(() => {
    if (type !== 'email') {
      return '';
    }

    if (/<html[\s>]/i.test(previewBody)) {
      return previewBody;
    }

    return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${previewBody}</body></html>`;
  }, [previewBody, type]);

  return (
    <div className="h-full rounded-lg border border-slate-300 bg-white p-4 text-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview ({type})</p>
          <p className="mt-1 text-sm text-slate-700">{previewSubject}</p>
        </div>
        <div className="flex max-w-[55%] flex-wrap justify-end gap-1">
          {variables.map((variable) => (
            <span
              key={variable}
              className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600"
            >
              {`{{${variable}}}`}
            </span>
          ))}
        </div>
      </div>

      {type === 'email' ? (
        <iframe
          title="Email template preview"
          className="h-[64vh] min-h-[420px] w-full rounded-md border border-slate-300 bg-white"
          sandbox=""
          srcDoc={previewDocument}
        />
      ) : (
        <pre className="h-[64vh] min-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {previewBody}
        </pre>
      )}
    </div>
  );
}
