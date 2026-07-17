'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/ui/primitives';
import { fmtDate, fmtNumber } from '@/lib/format';

export default function MovementsPage() {
  const { t, locale } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ['all-movements'],
    queryFn: () => get('/stock-movements'),
  });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('nav.stockMovements')}</h1>
      <Card>
        <DataTable
          data={data ?? []}
          loading={isLoading}
          searchKeys={['material.name', 'material.code', 'reference']}
          columns={[
            { key: 'date', header: t('common.date'), render: (r: any) => fmtDate(r.date, locale) },
            { key: 'material', header: t('nav.materials'), render: (r: any) => `${r.material?.code} — ${r.material?.name}` },
            { key: 'warehouse', header: t('nav.warehouses'), render: (r: any) => r.warehouse?.name },
            { key: 'type', header: 'Type', render: (r: any) => <StatusBadge status={r.type} /> },
            { key: 'quantity', header: 'Qty', align: 'end', render: (r: any) => <span className={`tabular-nums ${Number(r.quantity) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtNumber(Number(r.quantity), locale, 1)}</span> },
            { key: 'reference', header: 'Reference' },
          ]}
        />
      </Card>
    </div>
  );
}
