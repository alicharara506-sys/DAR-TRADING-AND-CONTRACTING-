'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useAuth, useI18n } from '@/components/providers';
import { Card, Kpi, ProgressBar, Spinner, StatusBadge } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { fmtCurrency, fmtNumber, fmtPercent } from '@/lib/format';

export default function ExecutiveDashboard() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const currency = user?.company.baseCurrency ?? 'USD';

  const { data, isLoading } = useQuery({
    queryKey: ['executive-dashboard'],
    queryFn: () => get('/dashboards/executive'),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }
  const p = data.portfolio;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.executive')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('dashboard.portfolio')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t('dashboard.activeProjects')} value={fmtNumber(p.activeCount, locale)} sub={`${fmtNumber(p.projectCount, locale)} total`} />
        <Kpi label={t('dashboard.contractValue')} value={fmtCurrency(p.totalContractValue, locale, currency)} />
        <Kpi
          label={t('dashboard.profitForecast')}
          value={fmtCurrency(p.totalProfitForecast, locale, currency)}
          tone={p.totalProfitForecast >= 0 ? 'good' : 'bad'}
        />
        <Kpi label={t('evm.spi')} value={p.avgSpi ?? '—'} tone={p.avgSpi >= 0.95 ? 'good' : p.avgSpi >= 0.85 ? 'warn' : 'bad'} />
        <Kpi label={t('evm.cpi')} value={p.avgCpi ?? '—'} tone={p.avgCpi >= 1 ? 'good' : p.avgCpi >= 0.9 ? 'warn' : 'bad'} />
        <Kpi label={t('dashboard.atRisk')} value={fmtNumber(p.atRisk, locale)} tone={p.atRisk > 0 ? 'warn' : 'good'} />
      </div>

      <Card title={t('nav.projects')}>
        <DataTable
          data={data.projects}
          searchKeys={['name', 'code', 'client']}
          columns={[
            {
              key: 'name',
              header: t('common.name'),
              render: (r: any) => (
                <Link href={`/${locale}/projects/${r.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                  {r.name}
                </Link>
              ),
            },
            { key: 'client', header: t('nav.clients') },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
            {
              key: 'progressPct',
              header: t('dashboard.overallProgress'),
              render: (r: any) => <ProgressBar value={r.progressPct} />,
              sortValue: (r: any) => r.progressPct,
            },
            { key: 'spi', header: 'SPI', align: 'end', render: (r: any) => <span className="tabular-nums">{r.spi ?? '—'}</span> },
            { key: 'cpi', header: 'CPI', align: 'end', render: (r: any) => <span className="tabular-nums">{r.cpi ?? '—'}</span> },
            {
              key: 'contractValue',
              header: t('dashboard.contractValue'),
              align: 'end',
              render: (r: any) => <span className="tabular-nums">{fmtCurrency(r.contractValue, locale, currency)}</span>,
              sortValue: (r: any) => r.contractValue,
            },
            {
              key: 'profitForecast',
              header: t('dashboard.profitForecast'),
              align: 'end',
              render: (r: any) => (
                <span className={`tabular-nums ${r.profitForecast >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmtCurrency(r.profitForecast, locale, currency)}
                </span>
              ),
            },
            { key: 'health', header: t('dashboard.health'), render: (r: any) => <StatusBadge status={r.health} /> },
          ]}
        />
      </Card>
    </div>
  );
}
