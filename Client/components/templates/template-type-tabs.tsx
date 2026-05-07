import type { TemplateType } from '@/lib/types/template';
import { Button } from '@/components/ui/button';

export type TemplateTypeTabValue = 'all' | TemplateType;

interface TemplateTypeTabsProps {
  value: TemplateTypeTabValue;
  onChange: (value: TemplateTypeTabValue) => void;
}

const TEMPLATE_TYPE_OPTIONS: Array<{ label: string; value: TemplateTypeTabValue }> = [
  { label: 'All', value: 'all' },
  { label: 'Email', value: 'email' },
];

export function TemplateTypeTabs({ value, onChange }: TemplateTypeTabsProps) {
  return (
    <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
      {TEMPLATE_TYPE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? 'default' : 'ghost'}
          className={value === option.value ? '' : 'text-zinc-400 hover:text-zinc-100'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

