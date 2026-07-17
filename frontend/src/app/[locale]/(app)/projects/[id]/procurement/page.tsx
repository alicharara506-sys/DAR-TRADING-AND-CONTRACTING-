'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card, Spinner, StatusBadge } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { fmtCurrency, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ProcurementPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'pos' | 'prs' | 'rfqs'>('pos');

  const { data: pos, isLoading } = useQuery({
    queryKey: ['pos', id],
    queryFn: () => get(`/purchase-orders?projectId=${id}`),
  });
  const { data: prs } = useQuery({
    queryKey: ['prs', id],
    queryFn: () => get(`/projects/${id}/purchase-requests`),
    enabled: tab === 'prs',
  });
  const { data: rfqs } = useQuery({
    queryKey: ['rfqs', id],
    queryFn: () => get(`/projects/${id}/rfqs`),
    enabled: tab === 'rfqs',
  });

  const tabs = [
    { id: 'pos', label: t('nav.purchaseOrders') },
    { id: 'prs', label: t('nav.purchaseRequests') },
    { id: 'rfqs', label: t('nav.rfqs') },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-surface-muted-dark w-fit">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={cn('rounded-lg px-3 py-1.5 text-xs font-medium',
              tab === x.id ? 'bg-brand-700 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800')}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'pos' && (
        <Card>
          {isLoading ? <Spinner className="mx-auto my-16" /> : (
            <DataTable
              data={pos ?? []}
              searchKeys={['number', 'description', 'supplier.name']}
              columns={[
                { key: 'number', header: 'PO #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
                { key: 'description', header: t('common.description') },
                { key: 'supplier', header: t('nav.suppliers'), render: (r: any) => r.supplier?.name },
                { key: 'poDate', header: 'PO Date', render: (r: any) => fmtDate(r.poDate, locale) },
                { key: 'expectedDelivery', header: 'Delivery', render: (r: any) => fmtDate(r.expectedDelivery, locale) },
                { key: 'netAmount', header: 'Net', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.netAmount), locale)}</span> },
                { key: 'totalAmount', header: 'Total (incl. VAT)', align: 'end', render: (r: any) => <span className="font-medium tabular-nums">{fmtCurrency(Number(r.totalAmount), locale)}</span> },
                { key: 'paid', header: 'Paid', align: 'end', render: (r: any) => <span className="tabular-nums text-emerald-600">{fmtCurrency(r.paid, locale)}</span> },
                { key: 'outstanding', header: 'Outstanding', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(r.outstanding, locale)}</span> },
                { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
              ]}
            />
          )}
        </Card>
      )}

      {tab === 'prs' && (
        <Card>
          <DataTable
            data={prs ?? []}
            searchKeys={['number', 'description']}
            columns={[
              { key: 'number', header: 'PR #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
              { key: 'description', header: t('common.description') },
              { key: 'neededBy', header: 'Needed by', render: (r: any) => fmtDate(r.neededBy, locale) },
              { key: 'lines', header: 'Lines', align: 'end', render: (r: any) => r.lines?.length ?? 0 },
              { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
            ]}
          />
        </Card>
      )}

      {tab === 'rfqs' && (
        <Card>
          <DataTable
            data={rfqs ?? []}
            searchKeys={['number', 'description']}
            columns={[
              { key: 'number', header: 'RFQ #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
              { key: 'description', header: t('common.description') },
              { key: 'vendors', header: 'Vendors', align: 'end', render: (r: any) => r.vendors?.length ?? 0 },
              { key: 'quotations', header: 'Quotes', align: 'end', render: (r: any) => r.quotations?.length ?? 0 },
              { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
