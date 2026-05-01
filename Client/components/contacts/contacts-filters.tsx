import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ContactsFilterState {
  search: string;
  status: string;
  category: string;
  contactName: string;
  email: string;
  company: string;
  country: string;
  city: string;
  telephone: string;
  mobile: string;
  additionalNumber: string;
  designation: string;
  department: string;
  leadSource: string;
}

interface ContactsFiltersProps {
  filters: ContactsFilterState;
  categoryOptions: string[];
  onChange: (patch: Partial<ContactsFilterState>) => void;
  onReset: () => void;
}

export function ContactsFilters({ filters, categoryOptions, onChange, onReset }: ContactsFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="border-zinc-800 bg-zinc-900 pl-9 text-zinc-100"
            placeholder="Global search across contact fields..."
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
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Contact Name"
          value={filters.contactName}
          onChange={(event) => onChange({ contactName: event.target.value })}
        />
        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Email"
          value={filters.email}
          onChange={(event) => onChange({ email: event.target.value })}
        />
        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Company"
          value={filters.company}
          onChange={(event) => onChange({ company: event.target.value })}
        />
        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Country"
          value={filters.country}
          onChange={(event) => onChange({ country: event.target.value })}
        />

        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="City"
          value={filters.city}
          onChange={(event) => onChange({ city: event.target.value })}
        />
        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Telephone"
          value={filters.telephone}
          onChange={(event) => onChange({ telephone: event.target.value })}
        />
        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Mobile"
          value={filters.mobile}
          onChange={(event) => onChange({ mobile: event.target.value })}
        />
        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Additional Number"
          value={filters.additionalNumber}
          onChange={(event) => onChange({ additionalNumber: event.target.value })}
        />

        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Designation"
          value={filters.designation}
          onChange={(event) => onChange({ designation: event.target.value })}
        />
        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Department"
          value={filters.department}
          onChange={(event) => onChange({ department: event.target.value })}
        />
        <Input
          className="border-zinc-800 bg-zinc-900 text-zinc-100"
          placeholder="Source"
          value={filters.leadSource}
          onChange={(event) => onChange({ leadSource: event.target.value })}
        />

        <Button
          type="button"
          variant="outline"
          className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          onClick={onReset}
        >
          Reset Filters
        </Button>
      </div>
    </div>
  );
}
