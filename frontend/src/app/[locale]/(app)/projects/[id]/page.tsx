'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useAuth, useI18n } from '@/components/providers';
import { Card, Kpi, ProgressBar, Spinner, StatusBadge } from '@/components/ui/primitives';
import { BudgetBarChart, DonutChart, SCurveChart } from '@/components/charts';
import { fmtCurrency, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';

export default function ProjectDashboard() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const currency = user?.company.baseCurrency ?? 'USD';

  const { data, isLoading } = useQuery({
    queryKey: ['project-dashboard', params.id],
    queryFn: () => get(`/dashboards/projects/${params.id}`),
  });
  const { data: curve } = useQuery({
    queryKey: ['evm-curve', params.id],
    queryFn: () => get(`/projects/${params.id}/finance/evm-curve`),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const k = data.kpis;
  const taskData = Object.entries(data.taskBreakdown ?? {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value: value as number,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label={t('dashboard.overallProgress')} value={fmtPercent(k.overallProgress, locale)} />
        <Kpi label={t('dashboard.budgetUtilized')} value={fmtPercent(k.budgetUtilized, locale)} />
        <Kpi label="CPI" value={k.cpi} tone={k.cpi >= 1 ? 'good' : k.cpi >= 0.9 ? 'warn' : 'bad'} />
        <Kpi label="SPI" value={k.spi} tone={k.spi >= 0.95 ? 'good' : k.spi >= 0.85 ? 'warn' : 'bad'} />
        <Kpi label={t('dashboard.contractValue')} value={fmtCurrency(data.project.contractValue, locale, currency)} />
        <Kpi label={t('dashboard.costToDate')} value={fmtCurrency(k.costToDate, locale, currency)} />
        <Kpi label={t('dashboard.daysRemaining')} value={fmtNumber(data.project.daysRemaining, locale)} />
        <Kpi
          label={t('dashboard.profitForecast')}
          value={fmtCurrency(k.profitForecast, locale, currency)}
          tone={k.profitForecast >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t('dashboard.sCurve')} className="xl:col-span-2">
          {curve ? <SCurveChart data={curve} /> : <Spinner className="mx-auto my-20" />}
        </Card>
        <Card title={t('dashboard.taskStatus')}>
          <DonutChart data={taskData} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t('dashboard.budgetVsActual')} className="xl:col-span-2">
          <BudgetBarChart data={data.budgetByCategory} />
        </Card>
        <Card title={t('dashboard.upcomingMilestones')}>
          <div className="space-y-3">
            {data.milestones.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-zinc-400">{fmtDate(m.targetDate, locale)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <ProgressBar value={Number(m.progressPct)} />
                  <StatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title={t('dashboard.upcomingTasks')}>
        <div className="grid gap-2 md:grid-cols-2">
          {data.upcomingTasks.map((task: any) => (
            <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
              <div className="min-w-0">
                <p className="truncate text-sm">{task.name.trim()}</p>
                <p className="text-xs text-zinc-400">
                  {fmtDate(task.plannedStart, locale)} → {fmtDate(task.plannedFinish, locale)}
                </p>
              </div>
              <StatusBadge status={task.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
