'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card, Kpi, StatusBadge } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { fmtCurrency, fmtDate, fmtNumber } from '@/lib/format';

export default function AllPurchaseOrdersPage() {
  const { t, locale } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ['all-pos'], queryFn: () => get('/purchase-orders') });
  const { data: summary } = useQuery({ queryKey: ['proc-summary'], queryFn: () => get('/procurement/summary') });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('nav.purchaseOrders')}</h1>
      {summary && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Kpi label="Purchase orders" value={fmtNumber(summary.poCount, locale)} />
          <Kpi label="Committed" value={fmtCurrency(summary.totalCommitted, locale)} />
          <Kpi label="Paid" value={fmtCurrency(summary.totalPaid, locale)} tone="good" />
          <Kpi label="Outstanding" value={fmtCurrency(summary.totalOutstanding, locale)} tone={summary.totalOutstanding > 0 ? 'warn' : 'good'} />
        </div>
      )}
      <Card>
        <DataTable
          data={data ?? []}
          loading={isLoading}
          searchKeys={['number', 'description', 'supplier.name', 'project.name']}
          columns={[
            { key: 'number', header: 'PO #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'project', header: t('nav.projects'), render: (r: any) => r.project?.code },
            { key: 'description', header: t('common.description') },
            { key: 'supplier', header: t('nav.suppliers'), render: (r: any) => r.supplier?.name },
            { key: 'poDate', header: t('common.date'), render: (r: any) => fmtDate(r.poDate, locale) },
            { key: 'totalAmount', header: t('common.total'), align: 'end', render: (r: any) => <span className="font-medium tabular-nums">{fmtCurrency(Number(r.totalAmount), locale)}</span>, sortValue: (r: any) => Number(r.totalAmount) },
            { key: 'paid', header: 'Paid', align: 'end', render: (r: any) => <span className="tabular-nums text-emerald-600">{fmtCurrency(r.paid, locale)}</span> },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
