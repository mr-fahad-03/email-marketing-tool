'use client';

import { usePathname } from 'next/navigation';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const isTemplateFullPageView =
    pathname === '/dashboard/templates/new' ||
    /^\/dashboard\/templates\/[^/]+(?:\/edit)?$/.test(pathname);
  const hideSidebarOnLibraryUsePage = /^\/dashboard\/templates\/library\/[^/]+\/use$/.test(
    pathname,
  );

  if (isTemplateFullPageView) {
    return (
      <div className="min-h-screen bg-zinc-100 text-zinc-900">
        <main className="min-h-screen">{children}</main>
      </div>
    );
  }

  return (
    <div
      className={
        hideSidebarOnLibraryUsePage
          ? 'dashboard-shell-root h-screen overflow-hidden bg-zinc-100 text-zinc-900'
          : 'dashboard-shell-root min-h-screen bg-zinc-100 text-zinc-900'
      }
    >
      {!hideSidebarOnLibraryUsePage ? <DashboardSidebar /> : null}
      <div
        className={
          hideSidebarOnLibraryUsePage
            ? 'flex h-screen w-full flex-col overflow-hidden'
            : 'flex min-h-screen w-full flex-col md:pl-72'
        }
      >
        <DashboardHeader />
        {hideSidebarOnLibraryUsePage ? (
          <main className="dashboard-shell-main h-full min-h-0 flex-1 overflow-hidden bg-zinc-100 p-0">{children}</main>
        ) : (
          <main className="dashboard-shell-main flex-1 bg-zinc-100 p-4 md:p-6">
            <div className="dashboard-shell-content mx-auto h-full w-full max-w-7xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
              {children}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
