'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card, Kpi, Spinner } from '@/components/ui/primitives';
import { fmtCurrency, fmtNumber } from '@/lib/format';

export default function KpisPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['kpis', id],
    queryFn: () => get(`/projects/${id}/kpis`),
  });

  if (isLoading || !data) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('nav.kpis')}</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="SPI" value={data.schedule.spi} tone={data.schedule.spi >= 0.95 ? 'good' : 'warn'} />
        <Kpi label="Delayed tasks" value={fmtNumber(data.schedule.delayedTasks, locale)} tone={data.schedule.delayedTasks > 0 ? 'bad' : 'good'} />
        <Kpi label="CPI" value={data.cost.cpi} tone={data.cost.cpi >= 1 ? 'good' : 'warn'} />
        <Kpi label="TCPI" value={data.cost.tcpi} />
        <Kpi label="EAC" value={fmtCurrency(data.cost.eac, locale)} />
        <Kpi label="VAC" value={fmtCurrency(data.cost.vac, locale)} tone={data.cost.vac >= 0 ? 'good' : 'bad'} />
        <Kpi label="Open NCRs" value={fmtNumber(data.quality.openNcrs, locale)} tone={data.quality.openNcrs > 0 ? 'warn' : 'good'} />
        <Kpi label="LTI incidents" value={fmtNumber(data.safety.ltiCount, locale)} tone={data.safety.ltiCount > 0 ? 'bad' : 'good'} />
        <Kpi label="Open RFIs" value={fmtNumber(data.documents.openRfis, locale)} />
        <Kpi label="Pending submittals" value={fmtNumber(data.documents.pendingSubmittals, locale)} />
        <Kpi label="Purchase orders" value={fmtNumber(data.procurement.poCount, locale)} />
      </div>
    </div>
  );
}
