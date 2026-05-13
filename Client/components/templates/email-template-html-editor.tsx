'use client';

import { type ReactNode, useMemo } from 'react';
import { LayoutTemplateEditor } from '@/components/templates/layout-template-editor';

interface EmailTemplateHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  designJson?: Record<string, unknown> | null;
  onDesignChange?: (design: Record<string, unknown> | null) => void;
  mjmlValue?: string | null;
  onMjmlChange?: (mjml: string | null) => void;
  onUserEdit?: () => void;
  headerActions?: ReactNode;
  previewHeaderActions?: ReactNode;
  fullHeight?: boolean;
  showHelpText?: boolean;
  previewBlocked?: boolean;
  onPreviewBlocked?: () => void;
}

function stripToBodyContent(source: string): string {
  const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1];
  }

  return source;
}

function toFallbackMjmlFromHtml(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('<mjml')) {
    return trimmed;
  }

  const content = stripToBodyContent(trimmed).replace(/<\/mj-raw>/gi, '&lt;/mj-raw&gt;');
  return `<mjml><mj-body><mj-section padding="0"><mj-column><mj-raw>${content}</mj-raw></mj-column></mj-section></mj-body></mjml>`;
}

export function EmailTemplateHtmlEditor({
  value,
  onChange,
  designJson,
  onDesignChange,
  mjmlValue,
  onMjmlChange,
  onUserEdit,
  headerActions,
  previewHeaderActions,
  fullHeight = false,
  showHelpText,
  previewBlocked,
  onPreviewBlocked,
}: EmailTemplateHtmlEditorProps) {
  const resolvedMjmlValue = useMemo(() => {
    const explicitMjml = (mjmlValue ?? '').trim();
    if (explicitMjml) {
      return explicitMjml;
    }

    return toFallbackMjmlFromHtml(value);
  }, [mjmlValue, value]);

  return (
    <LayoutTemplateEditor
      value={value}
      onChange={onChange}
      designJson={designJson}
      onDesignChange={onDesignChange}
      mjmlValue={resolvedMjmlValue}
      onMjmlChange={onMjmlChange}
      onUserEdit={onUserEdit}
      headerActions={headerActions}
      previewHeaderActions={previewHeaderActions}
      fullHeight={fullHeight}
      showHelpText={showHelpText}
      previewBlocked={previewBlocked}
      onPreviewBlocked={onPreviewBlocked}
    />
  );
}
