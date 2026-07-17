'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { fmtCurrency, fmtDate } from '@/lib/format';

export default function SupplierPaymentsPage() {
  const { t, locale } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => get('/supplier-payments'),
  });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('nav.supplierPayments')}</h1>
      <Card>
        <DataTable
          data={data ?? []}
          loading={isLoading}
          searchKeys={['supplier.name', 'reference', 'purchaseOrder.number']}
          columns={[
            { key: 'date', header: t('common.date'), render: (r: any) => fmtDate(r.date, locale) },
            { key: 'supplier', header: t('nav.suppliers'), render: (r: any) => <span className="font-medium">{r.supplier?.name}</span> },
            { key: 'purchaseOrder', header: 'PO', render: (r: any) => <span className="font-mono text-xs">{r.purchaseOrder?.number ?? '—'}</span> },
            { key: 'amount', header: t('common.amount'), align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.amount), locale)}</span>, sortValue: (r: any) => Number(r.amount) },
            { key: 'method', header: 'Method', render: (r: any) => r.method?.replace(/_/g, ' ') },
            { key: 'reference', header: 'Reference' },
          ]}
        />
      </Card>
    </div>
  );
}
