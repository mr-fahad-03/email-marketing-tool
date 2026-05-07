import { templateFormSchema, type TemplateFormValues } from '@/lib/validators/template';

const DRAFT_KEY_PREFIX = 'template-library-draft:';

function getDraftKey(templateId: string): string {
  return `${DRAFT_KEY_PREFIX}${templateId}`;
}

export function saveLibraryTemplateDraft(templateId: string, values: TemplateFormValues): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(getDraftKey(templateId), JSON.stringify(values));
}

export function readLibraryTemplateDraft(templateId: string): TemplateFormValues | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(getDraftKey(templateId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = templateFormSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }

    return result.data;
  } catch {
    return null;
  }
}

export function clearLibraryTemplateDraft(templateId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(getDraftKey(templateId));
}
