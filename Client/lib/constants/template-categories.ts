import type { TemplateCategory } from '@/lib/types/template';

export const TEMPLATE_CATEGORY_OPTIONS: Array<{ value: TemplateCategory; label: string }> = [
  { value: 'other', label: 'Other' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'ecommerce', label: 'Ecommerce' },
  { value: 'travel', label: 'Travel' },
  { value: 'business', label: 'Business' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'education', label: 'Education' },
  { value: 'online-store', label: 'Online Store' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'general', label: 'General' },
  { value: 'holidays', label: 'Holidays' },
  { value: 'tourism', label: 'Tourism' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'utility', label: 'Utility' },
  { value: 'authentication', label: 'Authentication' },
];

export const TEMPLATE_LIBRARY_CATEGORY_OPTIONS = TEMPLATE_CATEGORY_OPTIONS.filter((option) =>
  [
    'other',
    'holiday',
    'ecommerce',
    'travel',
    'business',
    'restaurant',
    'education',
  ].includes(option.value),
);

const CATEGORY_LABEL_MAP = new Map(TEMPLATE_CATEGORY_OPTIONS.map((item) => [item.value, item.label]));

function formatDynamicCategoryLabel(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getTemplateCategoryLabel(category: string | undefined): string {
  if (!category) {
    return 'General';
  }

  return CATEGORY_LABEL_MAP.get(category as TemplateCategory) ?? formatDynamicCategoryLabel(category);
}
