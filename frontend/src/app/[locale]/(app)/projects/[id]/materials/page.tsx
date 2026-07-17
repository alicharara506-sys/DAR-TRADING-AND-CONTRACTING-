'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card, StatusBadge } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { fmtDate, fmtNumber } from '@/lib/format';

export default function ProjectMaterialsPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data: mrs, isLoading } = useQuery({
    queryKey: ['mrs', id],
    queryFn: () => get(`/projects/${id}/material-requests`),
  });
  const { data: movements } = useQuery({
    queryKey: ['movements', id],
    queryFn: () => get(`/stock-movements?projectId=${id}`),
  });

  return (
    <div className="space-y-6">
      <Card title={t('nav.materialRequests')}>
        <DataTable
          data={mrs ?? []}
          loading={isLoading}
          searchKeys={['number']}
          columns={[
            { key: 'number', header: 'MR #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'neededBy', header: 'Needed by', render: (r: any) => fmtDate(r.neededBy, locale) },
            { key: 'lines', header: 'Lines', align: 'end', render: (r: any) => r.lines?.length ?? 0 },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </Card>
      <Card title={t('nav.stockMovements')}>
        <DataTable
          data={movements ?? []}
          searchKeys={['material.name', 'reference']}
          columns={[
            { key: 'date', header: t('common.date'), render: (r: any) => fmtDate(r.date, locale) },
            { key: 'material', header: t('nav.materials'), render: (r: any) => `${r.material?.code} — ${r.material?.name}` },
            { key: 'warehouse', header: t('nav.warehouses'), render: (r: any) => r.warehouse?.name },
            { key: 'type', header: 'Type', render: (r: any) => <StatusBadge status={r.type} /> },
            { key: 'quantity', header: 'Qty', align: 'end', render: (r: any) => <span className={`tabular-nums ${Number(r.quantity) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtNumber(Number(r.quantity), locale, 1)}</span> },
            { key: 'reference', header: 'Ref' },
          ]}
        />
      </Card>
    </div>
  );
}
