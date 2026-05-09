'use client';

import { Code2, FolderKanban, LayoutTemplate, PlusCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TemplateLibraryGrid } from '@/components/templates/template-library-grid';
import { TemplatesFilters } from '@/components/templates/templates-filters';
import { TemplatesTable } from '@/components/templates/templates-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HttpClientError } from '@/lib/api/errors';
import {
  getMjmlProviderStatus,
  getMjmlProviderTemplates,
  getTemplates,
} from '@/lib/api/templates';
import type { TemplateLibraryItem } from '@/lib/constants/email-template-library';
import {
  getTemplateCategoryLabel,
} from '@/lib/constants/template-categories';
import type {
  MarketingTemplate,
  ProviderStatus,
  TemplateLayoutPreset,
} from '@/lib/types/template';

type TemplatesSection = 'personal' | 'library';
type PrebuiltLayoutPreset = Exclude<TemplateLayoutPreset, 'empty'>;

const PREBUILT_LAYOUT_OPTIONS: Array<{
  id: PrebuiltLayoutPreset;
  title: string;
}> = [
  { id: 'basic', title: 'Basic' },
  { id: 'commerce', title: 'Commerce' },
  { id: 'three-columns', title: 'Three columns' },
  { id: 'news', title: 'News' },
  { id: 'text', title: 'Text' },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

function inferCategoryFromProviderTemplate(item: {
  categoryHints: string[];
}): NonNullable<MarketingTemplate['category']> {
  const first = item.categoryHints[0]?.trim().toLowerCase();
  if (first) {
    return first as NonNullable<MarketingTemplate['category']>;
  }

  return 'general';
}

function LayoutPresetThumbnail({ preset }: { preset: PrebuiltLayoutPreset }) {
  const base =
    'h-[104px] rounded-md border border-[#cfd4d8] bg-[#f4f5f6] p-3';
  const lineStrong = 'rounded bg-[#c1c8ce]';
  const lineSoft = 'rounded bg-[#d5d9dd]';
  const blockBlue = 'rounded bg-[#a8c2d0]';

  if (preset === 'basic') {
    return (
      <div className={base}>
        <div className={`mb-3 h-8 ${blockBlue}`} />
        <div className={`mb-1.5 h-1.5 w-[92%] ${lineStrong}`} />
        <div className={`mb-1.5 h-1.5 w-[82%] ${lineSoft}`} />
        <div className={`mb-1.5 h-1.5 w-[88%] ${lineSoft}`} />
        <div className={`mb-1.5 h-1.5 w-[84%] ${lineSoft}`} />
        <div className={`mb-1.5 h-1.5 w-[72%] ${lineSoft}`} />
        <div className={`mt-2 h-3 w-9 ${lineStrong}`} />
      </div>
    );
  }

  if (preset === 'commerce') {
    return (
      <div className={base}>
        <div className={`mb-2 h-1.5 w-4/5 ${lineStrong}`} />
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="space-y-1">
              <div className={`h-4 ${blockBlue}`} />
              <div className={`h-1.5 ${lineStrong}`} />
              <div className={`h-1.5 w-4/5 ${lineSoft}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (preset === 'three-columns') {
    return (
      <div className={base}>
        <div className={`mb-2 h-1.5 w-4/5 ${lineStrong}`} />
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="space-y-1">
              <div className={`h-4 ${blockBlue}`} />
              <div className={`h-4 ${blockBlue}`} />
              <div className={`h-1.5 ${lineStrong}`} />
              <div className={`h-1.5 w-4/5 ${lineSoft}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (preset === 'news') {
    return (
      <div className={base}>
        <div className={`mb-2 h-1.5 w-4/5 ${lineStrong}`} />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <div className={`mb-1.5 h-1.5 w-[95%] ${lineSoft}`} />
            <div className={`mb-1.5 h-1.5 w-[88%] ${lineSoft}`} />
            <div className={`mb-1.5 h-1.5 w-[90%] ${lineSoft}`} />
            <div className={`mb-1.5 h-1.5 w-[84%] ${lineSoft}`} />
            <div className={`mb-1.5 h-1.5 w-[78%] ${lineSoft}`} />
          </div>
          <div className="space-y-2">
            <div className={`h-8 w-7 ${blockBlue}`} />
            <div className={`h-8 w-7 ${blockBlue}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={base}>
      <div className={`mb-2 h-1.5 w-4/5 ${lineStrong}`} />
      <div className="space-y-1">
        {Array.from({ length: 9 }).map((_, idx) => (
          <div key={idx} className={`h-1.5 ${idx % 3 === 2 ? 'w-5/6' : 'w-full'} ${lineSoft}`} />
        ))}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<TemplatesSection>('library');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeLibraryCategory, setActiveLibraryCategory] = useState('all');

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);

  const [allTemplates, setAllTemplates] = useState<MarketingTemplate[]>([]);
  const [isAllTemplatesLoading, setIsAllTemplatesLoading] = useState(false);

  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [providerTemplates, setProviderTemplates] = useState<TemplateLibraryItem[]>([]);
  const [libraryCategoryOptions, setLibraryCategoryOptions] = useState<string[]>([]);
  const [isProviderLoading, setIsProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedTemplates() {
      setIsAllTemplatesLoading(true);
      try {
        const response = await getTemplates({
          page: 1,
          limit: 100,
          search: debouncedSearch || undefined,
        });

        if (!cancelled) {
          setAllTemplates(response.items);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setAllTemplates([]);
          toast.error(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsAllTemplatesLoading(false);
        }
      }
    }

    void loadSavedTemplates();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviderStatus() {
      try {
        const status = await getMjmlProviderStatus();
        if (!cancelled) {
          setProviderStatus(status);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setProviderStatus({
            provider: 'mjml',
            enabled: false,
            configured: false,
            renderMode: 'hybrid',
            apiReachable: null,
            fallbackToLocal: false,
            message: getErrorMessage(error),
          });
        }
      }
    }

    void loadProviderStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!providerStatus?.configured) {
      setProviderTemplates([]);
      setLibraryCategoryOptions([]);
      return;
    }

    let cancelled = false;

    async function loadProviderTemplates() {
      setIsProviderLoading(true);
      setProviderError(null);

      try {
        const limit = 50;
        let page = 0;
        let total = 0;
        const allItems: Array<{
          templateId: string;
          name: string;
          thumbnail: string;
          categoryHints: string[];
        }> = [];

        while (true) {
          const response = await getMjmlProviderTemplates({
            category: activeLibraryCategory === 'all' ? undefined : activeLibraryCategory,
            search: debouncedSearch || undefined,
            limit,
            page,
          });

          total = response.total;
          allItems.push(...response.items);

          if (response.items.length === 0 || allItems.length >= total) {
            break;
          }

          page += 1;
          if (page > 50) {
            break;
          }
        }

        const mappedItems: TemplateLibraryItem[] = allItems.map((item) => {
          const category = inferCategoryFromProviderTemplate(item);
          return {
            id: `mjml-${item.templateId}`,
            source: 'provider',
            provider: 'mjml',
            providerTemplateId: item.templateId,
            name: item.name,
            category,
            subject: item.name,
            body: '',
            summary: `Official MJML template - ${item.categoryHints.join(', ') || 'general'}`,
            previewImageUrl: item.thumbnail || undefined,
            editorType: 'layout',
            layoutPreset: null,
            designJson: null,
          };
        });

        const discoveredCategories = Array.from(
          new Set(
            mappedItems
              .map((item) => item.category)
              .filter(
                (
                  category,
                ): category is NonNullable<MarketingTemplate['category']> => Boolean(category),
              ),
          ),
        );

        if (!cancelled) {
          setProviderTemplates(mappedItems);
          setLibraryCategoryOptions((previous) => {
            if (activeLibraryCategory === 'all' || previous.length === 0) {
              return discoveredCategories;
            }

            const merged = [...previous];
            for (const category of discoveredCategories) {
              if (!merged.includes(category)) {
                merged.push(category);
              }
            }
            return merged;
          });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setProviderTemplates([]);
          setLibraryCategoryOptions([]);
          setProviderError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsProviderLoading(false);
        }
      }
    }

    void loadProviderTemplates();

    return () => {
      cancelled = true;
    };
  }, [activeLibraryCategory, debouncedSearch, providerStatus?.configured]);

  const libraryCategories = useMemo(
    () => ['all', ...libraryCategoryOptions],
    [libraryCategoryOptions],
  );

  const goToPreviewPage = (item: TemplateLibraryItem) => {
    if (!item.providerTemplateId) {
      return;
    }

    router.push(`/dashboard/templates/library/${encodeURIComponent(item.providerTemplateId)}/preview`);
  };

  const openHtmlPersonalCreatorPage = () => {
    setIsCreateDialogOpen(false);
    router.push('/dashboard/templates/new?editor=html');
  };

  const openLayoutPersonalCreatorPage = (preset: PrebuiltLayoutPreset) => {
    setIsCreateDialogOpen(false);
    router.push(`/dashboard/templates/new?editor=layout&preset=${encodeURIComponent(preset)}`);
  };

  const openTemplateDetailsPage = (template: MarketingTemplate) => {
    router.push(`/dashboard/templates/${encodeURIComponent(template.id)}`);
  };

  const openCreateTemplateDialog = () => {
    setShowLayoutPicker(false);
    setIsCreateDialogOpen(true);
  };

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Email Templates</h2>
          <p className="text-sm text-zinc-400">Create personal templates or browse the professional library.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            onClick={openCreateTemplateDialog}
          >
            <PlusCircle className="h-4 w-4" />
            Add Template
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700"
            onClick={() => router.push('/dashboard/templates/image-manager')}
          >
            <FolderKanban className="h-4 w-4" />
            Image Manager
          </button>
        </div>
      </div>

      <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${
            activeSection === 'personal'
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-300 hover:bg-zinc-800'
          }`}
          onClick={() => setActiveSection('personal')}
        >
          Personal
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${
            activeSection === 'library'
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-300 hover:bg-zinc-800'
          }`}
          onClick={() => setActiveSection('library')}
        >
          Template Library
        </button>
      </div>

      {activeSection === 'personal' ? (
        <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
          <CardHeader className="space-y-4">
            <CardTitle className="text-base">Personal Templates</CardTitle>
            <TemplatesFilters
              search={search}
              type="all"
              showTypeTabs={false}
              onSearchChange={setSearch}
              onTypeChange={() => {}}
            />
          </CardHeader>
          <CardContent>
            <TemplatesTable
              templates={allTemplates}
              isLoading={isAllTemplatesLoading}
              onCardClick={openTemplateDetailsPage}
            />
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setShowLayoutPicker(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl border-slate-200 bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                className="rounded-xl border border-teal-300 bg-teal-50 p-6 text-left transition hover:border-teal-400 hover:bg-teal-50"
                onClick={() => setShowLayoutPicker((current) => !current)}
              >
                <LayoutTemplate className="mb-4 h-8 w-8 text-teal-600" />
                <p className="text-lg font-semibold text-slate-900">Layout Template Editor</p>
                <p className="mt-2 text-sm text-slate-600">
                  Choose from pre-built layout templates, then start editing visually.
                </p>
              </button>
              <button
                type="button"
                className="rounded-xl border border-sky-300 bg-sky-50 p-6 text-left transition hover:border-sky-400 hover:bg-sky-50"
                onClick={openHtmlPersonalCreatorPage}
              >
                <Code2 className="mb-4 h-8 w-8 text-sky-600" />
                <p className="text-lg font-semibold text-slate-900">HTML Editor</p>
                <p className="mt-2 text-sm text-slate-600">
                  Create your personal template directly with HTML markup.
                </p>
              </button>
            </div>
            {showLayoutPicker ? (
              <div className="mt-6 rounded-lg bg-[#4d5a5e] p-6">
                <div className="grid justify-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {PREBUILT_LAYOUT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="w-full rounded-lg border border-[#d9dcdf] bg-[#f4f5f6] p-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.04)] transition hover:bg-white sm:max-w-[165px]"
                      onClick={() => openLayoutPersonalCreatorPage(option.id)}
                    >
                      <LayoutPresetThumbnail preset={option.id} />
                      <p className="mt-3 text-center text-[13px] leading-[1.2] font-normal text-[#00a0d3]">
                        {option.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {activeSection === 'library' ? (
        <Card className="border-zinc-800 bg-zinc-900/60 text-zinc-100">
          <CardHeader className="space-y-4">
            <CardTitle className="text-base">Template Library</CardTitle>

            <TemplatesFilters
              search={search}
              type="all"
              showTypeTabs={false}
              onSearchChange={setSearch}
              onTypeChange={() => {}}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
              <p className="mb-2">
                Templates are fetched from a professional provider API and displayed directly in this app.
              </p>
              {providerStatus ? (
                <span
                  className={
                    providerStatus.configured
                      ? 'rounded-md border border-emerald-700/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200'
                      : 'rounded-md border border-amber-700/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200'
                  }
                >
                  {providerStatus.message}
                </span>
              ) : null}
              {!providerStatus?.configured ? (
                <p className="mt-2 text-[11px] text-zinc-400">
                  Configure `MJML_PROVIDER_ENABLED=true` on backend.
                </p>
              ) : null}
              {providerError ? (
                <p className="mt-2 text-[11px] text-rose-300">Provider error: {providerError}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {libraryCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    activeLibraryCategory === category
                      ? 'border-zinc-100 bg-zinc-100 text-zinc-900'
                      : 'border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                  }`}
                  onClick={() => setActiveLibraryCategory(category)}
                >
                  {category === 'all' ? 'All' : getTemplateCategoryLabel(category)}
                </button>
              ))}
            </div>

            {isProviderLoading ? (
              <div className="text-xs text-zinc-400">Loading provider templates...</div>
            ) : null}
            <TemplateLibraryGrid
              items={providerTemplates}
              onPreviewTemplate={goToPreviewPage}
            />

            <div className="text-xs text-zinc-500">
              All provider-fetched templates are shown in this library tab.
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
