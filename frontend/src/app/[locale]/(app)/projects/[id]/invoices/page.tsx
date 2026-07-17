'use client';

import { useParams } from 'next/navigation';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { StatusBadge } from '@/components/ui/primitives';
import { fmtCurrency, fmtDate } from '@/lib/format';

export default function InvoicesPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  return (
    <CrudPage
      title={t('nav.invoices')}
      subtitle="VAT, retention & advance recovery auto-computed from contract terms"
      queryKey={['invoices', id]}
      listPath={`/projects/${id}/invoices`}
      createPath={`/projects/${id}/invoices`}
      updatePath={(r: any) => `/invoices/${r.id}`}
      searchKeys={['number', 'description']}
      extractList={(d) => d ?? []}
      columns={[
        { key: 'number', header: '#', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
        { key: 'issueDate', header: 'Issued', render: (r: any) => fmtDate(r.issueDate, locale) },
        { key: 'dueDate', header: 'Due', render: (r: any) => fmtDate(r.dueDate, locale) },
        { key: 'netAmount', header: 'Net', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.netAmount), locale)}</span> },
        { key: 'vatAmount', header: 'VAT', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.vatAmount), locale)}</span> },
        { key: 'retentionAmount', header: 'Retention', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.retentionAmount), locale)}</span> },
        { key: 'totalAmount', header: t('common.total'), align: 'end', render: (r: any) => <span className="font-medium tabular-nums">{fmtCurrency(Number(r.totalAmount), locale)}</span> },
        { key: 'received', header: 'Received', align: 'end', render: (r: any) => <span className="tabular-nums text-emerald-600">{fmtCurrency(r.received, locale)}</span> },
        { key: 'outstanding', header: 'Outstanding', align: 'end', render: (r: any) => <span className={`tabular-nums ${r.outstanding > 0 ? 'text-amber-600' : ''}`}>{fmtCurrency(r.outstanding, locale)}</span> },
        { key: 'overdueDays', header: 'Overdue', align: 'end', render: (r: any) => (r.overdueDays > 0 ? <span className="font-medium text-red-600">{r.overdueDays}d</span> : '—') },
        { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
      ]}
      fields={[
        { name: 'number', label: 'Invoice #', required: true },
        { name: 'description', label: t('common.description') },
        { name: 'issueDate', label: 'Issue date', type: 'date', required: true },
        { name: 'dueDate', label: 'Due date', type: 'date', required: true },
        { name: 'netAmount', label: 'Net amount', type: 'number', required: true },
        { name: 'status', label: t('common.status'), type: 'select', options: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CERTIFIED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DISPUTED'], defaultValue: 'DRAFT' },
      ]}
    />
  );
}
