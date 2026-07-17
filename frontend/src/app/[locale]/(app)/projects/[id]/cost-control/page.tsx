'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api, get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Button, Card, Kpi, Spinner, StatusBadge } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { BudgetBarChart } from '@/components/charts';
import { fmtCurrency, fmtPercent } from '@/lib/format';

export default function CostControlPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['cost-control', id],
    queryFn: () => get(`/projects/${id}/finance/cost-control`),
  });
  const { data: evm } = useQuery({
    queryKey: ['evm', id],
    queryFn: () => get(`/projects/${id}/finance/evm`),
  });
  const { data: forecast } = useQuery({
    queryKey: ['forecast', id],
    queryFn: () => get(`/projects/${id}/finance/forecast`),
  });

  const exportCsv = async () => {
    const res = await api<Response>(`/projects/${id}/exports/cost-control`, { raw: true });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cost-control.csv';
    a.click();
  };

  if (isLoading || !data) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {evm && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Kpi label="BAC" value={fmtCurrency(evm.bac, locale)} />
          <Kpi label="PV" value={fmtCurrency(evm.pv, locale)} />
          <Kpi label="EV" value={fmtCurrency(evm.ev, locale)} />
          <Kpi label="AC" value={fmtCurrency(evm.ac, locale)} />
          <Kpi label="CPI" value={evm.cpi} tone={evm.cpi >= 1 ? 'good' : 'bad'} />
          <Kpi label="SPI" value={evm.spi} tone={evm.spi >= 0.95 ? 'good' : 'warn'} />
          <Kpi label="EAC" value={fmtCurrency(evm.eac, locale)} />
          <Kpi label="VAC" value={fmtCurrency(evm.vac, locale)} tone={evm.vac >= 0 ? 'good' : 'bad'} />
        </div>
      )}

      {forecast?.regressionEac && (
        <Card title="AI Cost Prediction">
          <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
            <div><p className="kpi-value">{fmtCurrency(forecast.evmEac, locale)}</p><p className="text-xs text-zinc-500">EVM EAC</p></div>
            <div><p className="kpi-value">{fmtCurrency(forecast.regressionEac, locale)}</p><p className="text-xs text-zinc-500">Regression EAC</p></div>
            <div><p className="kpi-value text-brand-700 dark:text-brand-300">{fmtCurrency(forecast.blendedEac, locale)}</p><p className="text-xs text-zinc-500">Blended prediction</p></div>
            <div><p className="kpi-value">{fmtCurrency(forecast.monthlyBurnRate, locale)}</p><p className="text-xs text-zinc-500">Monthly burn rate</p></div>
          </div>
        </Card>
      )}

      <Card title={t('dashboard.budgetVsActual')}>
        <BudgetBarChart data={data.categories} />
      </Card>

      <Card
        title={t('nav.costControl')}
        action={
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        }
      >
        <DataTable
          data={data.lines}
          searchKeys={['code', 'name']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
            { key: 'name', header: t('common.name') },
            { key: 'category', header: 'Category' },
            { key: 'budget', header: 'Budget', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(r.budget, locale)}</span>, sortValue: (r: any) => r.budget },
            { key: 'actual', header: 'Actual', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(r.actual, locale)}</span>, sortValue: (r: any) => r.actual },
            { key: 'forecast', header: 'Forecast', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(r.forecast, locale)}</span> },
            { key: 'variance', header: 'Variance', align: 'end', render: (r: any) => <span className={`tabular-nums ${r.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtCurrency(r.variance, locale)}</span>, sortValue: (r: any) => r.variance },
            { key: 'utilization', header: 'Utilisation', align: 'end', render: (r: any) => fmtPercent(r.utilization, locale) },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
