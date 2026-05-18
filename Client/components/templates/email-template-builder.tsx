'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import 'react-quill-new/dist/quill.snow.css';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full animate-pulse rounded-md bg-zinc-100" />,
});

interface EmailTemplateBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

const MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['link', 'image'],
    ['clean'],
  ],
};

const FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'background',
  'list',
  'align',
  'link',
  'image',
];

const GUIDE_VARIABLES = [
  { tag: '{{firstName}}', description: "Contact's first name" },
  { tag: '{{lastName}}', description: "Contact's last name" },
  { tag: '{{fullName}}', description: "Contact's full name" },
  { tag: '{{email}}', description: "Contact's email address" },
  { tag: '{{phone}}', description: "Contact's phone number" },
  { tag: '{{company}}', description: "Contact's company name" },
  { tag: '{{category}}', description: "Contact's assigned category" },
  { tag: '{{labels}}', description: "Contact's labels (comma-separated)" },
  { tag: '{{campaign.name}}', description: "Name of the current campaign" },
];

export function EmailTemplateBuilder({ value, onChange }: EmailTemplateBuilderProps) {
  // Ensure we don't render an empty string as undefined in Quill
  const safeValue = useMemo(() => value || '', [value]);

  return (
    <div className="space-y-4">
      {/* Top Guide for Variables */}
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-zinc-800">
          Template Variables Guide
        </h4>
        <p className="mb-3 text-xs text-zinc-600">
          You can personalize your emails by typing the following tags directly into the editor below. When the email is sent, these tags will be automatically replaced with the contact&apos;s actual information.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {GUIDE_VARIABLES.map((variable) => (
            <div key={variable.tag} className="flex items-start gap-2">
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-medium text-zinc-800">
                {variable.tag}
              </code>
              <span className="text-xs text-zinc-500">{variable.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Simple WYSIWYG Editor */}
      <div className="rounded-md border border-zinc-200 bg-white">
        <style jsx global>{`
          .quill-editor-container .ql-container {
            border-bottom-left-radius: 0.375rem;
            border-bottom-right-radius: 0.375rem;
            font-family: inherit;
            font-size: 14px;
            min-height: 400px;
          }
          .quill-editor-container .ql-toolbar {
            border-top-left-radius: 0.375rem;
            border-top-right-radius: 0.375rem;
            border-bottom: 1px solid #e5e7eb;
            background-color: #f9fafb;
          }
          .quill-editor-container .ql-editor {
            min-height: 400px;
          }
        `}</style>
        <ReactQuill
          theme="snow"
          value={safeValue}
          onChange={onChange}
          modules={MODULES}
          formats={FORMATS}
          className="quill-editor-container"
          placeholder="Start typing your email content here. Use the toolbar above to format text, add links, or insert images. E.g. Hi {{firstName}}, ..."
        />
      </div>
    </div>
  );
}
