'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DeliveryBreakdown } from '@/lib/types/analytics';
import { formatNumber } from '@/lib/utils';

interface DeliveryBreakdownChartProps {
  data: DeliveryBreakdown;
}

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#64748b'];

export function DeliveryBreakdownChart({ data }: DeliveryBreakdownChartProps) {
  const chartData = [
    { name: 'Delivered', value: data.delivered },
    { name: 'Bounced', value: data.bounced },
    { name: 'Failed', value: data.failed },
    { name: 'Pending', value: data.pending },
  ];



  
  return (
    <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
      <CardHeader>
        <CardTitle className="text-base">Delivery Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={55}>
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatNumber(value)}
                contentStyle={{
                  backgroundColor: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#fafafa' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {chartData.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-zinc-300">{item.name}</span>
              </div>
              <span className="text-sm font-medium text-zinc-100">{formatNumber(item.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

