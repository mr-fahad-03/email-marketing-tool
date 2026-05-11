'use client';

import { BarChart3, Mail, Megaphone, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getDashboardOverview } from '@/lib/api/dashboard';
import { HttpClientError } from '@/lib/api/errors';
import type { DashboardOverview as DashboardOverviewData } from '@/lib/types/dashboard';
import { formatNumber } from '@/lib/utils';
import { DashboardOverviewSkeleton } from '@/components/dashboard/dashboard-overview-skeleton';
import { QuickStatCard } from '@/components/dashboard/quick-stat-card';
import { RecentActivityCard } from '@/components/dashboard/recent-activity-card';
import { StatCard } from '@/components/dashboard/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function getErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load dashboard data right now.';
}

export function DashboardOverview() {
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getDashboardOverview();
      setData(response);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  if (loading) {
    return <DashboardOverviewSkeleton />;
  }

  if (!data || error) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-base">Dashboard Unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-400">{error ?? 'No dashboard data found.'}</p>
          <Button variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800" onClick={() => void loadDashboard()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">Growth Command Center</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Snapshot of audience reach, campaign throughput, and cross-channel performance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Contacts"
          value={formatNumber(data.totals.totalContacts)}
          helper="Audience records in workspace"
          icon={Users}
        />
        <StatCard
          label="Total Campaigns"
          value={formatNumber(data.totals.totalCampaigns)}
          helper="All-time created campaigns"
          icon={Megaphone}
        />
        <StatCard
          label="Total Emails Sent"
          value={formatNumber(data.totals.totalEmailsSent)}
          helper="Delivered + attempted sends"
          icon={Mail}
        />
        <StatCard
          label="Total WhatsApp Messages"
          value={formatNumber(data.totals.totalWhatsAppMessages)}
          helper="Template and session sends"
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {data.quickStats.map((item) => (
              <QuickStatCard
                key={item.id}
                label={item.label}
                value={item.value}
                helper={item.helper}
              />
            ))}
          </CardContent>
        </Card>

        <RecentActivityCard items={data.recentActivity} />
      </div>
    </section>
  );
}
