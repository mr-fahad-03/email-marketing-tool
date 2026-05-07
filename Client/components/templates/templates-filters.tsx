import { Search } from 'lucide-react';
import { TemplateTypeTabs, type TemplateTypeTabValue } from '@/components/templates/template-type-tabs';
import { Input } from '@/components/ui/input';

interface TemplatesFiltersProps {
  search: string;
  type: TemplateTypeTabValue;
  showTypeTabs?: boolean;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: TemplateTypeTabValue) => void;
}

export function TemplatesFilters({
  search,
  type,
  showTypeTabs = true,
  onSearchChange,
  onTypeChange,
}: TemplatesFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {showTypeTabs ? <TemplateTypeTabs value={type} onChange={onTypeChange} /> : <div />}
      <div className="relative w-full lg:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="border-zinc-800 bg-zinc-900 pl-9 text-zinc-100"
          placeholder="Search template name or subject..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </div>
  );
}

