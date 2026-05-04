import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ContactsFilterState {
  search: string;
  status: string;
  category: string;
}

interface ContactsFiltersProps {
  filters: ContactsFilterState;
  categoryOptions: string[];
  onChange: (patch: Partial<ContactsFilterState>) => void;
  onReset: () => void;
}

export function ContactsFilters({ filters, categoryOptions, onChange, onReset }: ContactsFiltersProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_150px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="border-zinc-800 bg-zinc-900 pl-9 text-zinc-100"
          placeholder="Search contacts..."
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
        />
      </div>

      <select
        className="h-10 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value })}
      >
        <option value="">All Statuses</option>
        <option value="subscribed">Subscribed</option>
        <option value="unsubscribed">Unsubscribed</option>
        <option value="pending">Pending</option>
        <option value="suppressed">Suppressed</option>
      </select>

      <select
        className="h-10 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
        value={filters.category}
        onChange={(event) => onChange({ category: event.target.value })}
      >
        <option value="">All Categories</option>
        {categoryOptions.map((categoryOption) => (
          <option key={categoryOption} value={categoryOption}>
            {categoryOption}
          </option>
        ))}
      </select>

      <Button
        type="button"
        variant="outline"
        className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
        onClick={onReset}
      >
        Reset Filters
      </Button>
    </div>
  );
}
