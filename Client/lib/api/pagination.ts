export const BACKEND_MAX_PAGE_LIMIT = 100;

export function clampPageLimit(limit: number | undefined, fallback: number): number {
  const parsed = Number.isFinite(limit) ? Math.trunc(limit as number) : fallback;
  const normalized = parsed > 0 ? parsed : fallback;
  return Math.min(normalized, BACKEND_MAX_PAGE_LIMIT);
}

type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    totalPages: number;
  };
};

export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  options: { maxPages?: number; pageLimit?: number; startPage?: number } = {},
): Promise<T[]> {
  const pageLimit = clampPageLimit(options.pageLimit, BACKEND_MAX_PAGE_LIMIT);
  const startPage = options.startPage && options.startPage > 0 ? Math.trunc(options.startPage) : 1;
  const maxPages = options.maxPages && options.maxPages > 0 ? Math.trunc(options.maxPages) : 1000;

  const firstPage = await fetchPage(startPage, pageLimit);
  const merged = [...firstPage.items];
  const reportedTotalPages = Number.isFinite(firstPage.pagination.totalPages)
    ? Math.trunc(firstPage.pagination.totalPages)
    : startPage;
  const totalPages = Math.max(startPage, Math.min(reportedTotalPages || startPage, maxPages));

  for (let page = startPage + 1; page <= totalPages; page += 1) {
    const nextPage = await fetchPage(page, pageLimit);
    merged.push(...nextPage.items);
  }

  return merged;
}
