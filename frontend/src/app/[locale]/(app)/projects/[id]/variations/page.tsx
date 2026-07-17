'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { Kpi, StatusBadge } from '@/components/ui/primitives';
import { fmtCurrency, fmtDate } from '@/lib/format';

export default function VariationsPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data } = useQuery({
    queryKey: ['variations', id],
    queryFn: () => get(`/projects/${id}/variation-orders`),
  });
  const s = data?.summary;

  return (
    <div className="space-y-6">
      {s && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <Kpi label="Original contract" value={fmtCurrency(s.originalContract, locale)} />
          <Kpi label="Approved variations" value={fmtCurrency(s.approvedVariations, locale)} tone={s.approvedVariations >= 0 ? 'good' : 'bad'} />
          <Kpi label="Pending variations" value={fmtCurrency(s.pendingVariations, locale)} tone="warn" />
          <Kpi label="Revised contract" value={fmtCurrency(s.revisedContract, locale)} />
          <Kpi label="Schedule impact" value={`${s.approvedScheduleImpactDays > 0 ? '+' : ''}${s.approvedScheduleImpactDays}d`} />
        </div>
      )}
      <CrudPage
        title={t('nav.variations')}
        queryKey={['variations', id]}
        listPath={`/projects/${id}/variation-orders`}
        createPath={`/projects/${id}/variation-orders`}
        updatePath={(r: any) => `/variation-orders/${r.id}`}
        deletePath={(r: any) => `/variation-orders/${r.id}`}
        searchKeys={['number', 'description']}
        extractList={(d) => d?.variations ?? []}
        columns={[
          { key: 'number', header: 'VO #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
          { key: 'description', header: t('common.description') },
          { key: 'submittedAt', header: 'Submitted', render: (r: any) => fmtDate(r.submittedAt, locale) },
          { key: 'netAmount', header: 'Net', align: 'end', render: (r: any) => <span className={`tabular-nums ${Number(r.netAmount) < 0 ? 'text-red-600' : ''}`}>{fmtCurrency(Number(r.netAmount), locale)}</span> },
          { key: 'totalAmount', header: t('common.total'), align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.totalAmount), locale)}</span> },
          { key: 'internalStatus', header: 'DAR', render: (r: any) => <StatusBadge status={r.internalStatus} /> },
          { key: 'clientStatus', header: 'Client', render: (r: any) => <StatusBadge status={r.clientStatus} /> },
          { key: 'programmeImpactDays', header: 'Impact', align: 'end', render: (r: any) => `${r.programmeImpactDays > 0 ? '+' : ''}${r.programmeImpactDays}d` },
        ]}
        fields={[
          { name: 'description', label: t('common.description'), required: true, colSpan: 2 },
          { name: 'submittedAt', label: 'Submitted', type: 'date' },
          { name: 'netAmount', label: 'Net amount', type: 'number', required: true },
          { name: 'internalStatus', label: 'DAR status', type: 'select', options: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'], defaultValue: 'DRAFT' },
          { name: 'clientStatus', label: 'Client status', type: 'select', options: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'], defaultValue: 'SUBMITTED' },
          { name: 'programmeImpactDays', label: 'Programme impact (days)', type: 'number' },
        ]}
      />
    </div>
  );
}
