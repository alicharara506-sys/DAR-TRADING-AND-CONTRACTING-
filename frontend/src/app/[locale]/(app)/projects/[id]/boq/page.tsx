'use client';

import { useParams } from 'next/navigation';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { fmtCurrency, fmtNumber } from '@/lib/format';

export default function BoqPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  return (
    <CrudPage
      title={t('nav.boq')}
      queryKey={['boq', id]}
      listPath={`/projects/${id}/boq`}
      createPath={`/projects/${id}/boq`}
      updatePath={(r: any) => `/boq/${r.id}`}
      deletePath={(r: any) => `/boq/${r.id}`}
      searchKeys={['itemNo', 'description', 'section']}
      extractList={(d) => d ?? []}
      columns={[
        { key: 'itemNo', header: 'Item', render: (r: any) => <span className="font-mono text-xs">{r.itemNo}</span> },
        { key: 'description', header: t('common.description') },
        { key: 'section', header: 'Section' },
        { key: 'unit', header: 'Unit', align: 'center' },
        { key: 'quantity', header: 'Qty', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtNumber(Number(r.quantity), locale, 2)}</span> },
        { key: 'unitRate', header: 'Rate', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.unitRate), locale)}</span> },
        { key: 'amount', header: t('common.amount'), align: 'end', render: (r: any) => <span className="font-medium tabular-nums">{fmtCurrency(Number(r.amount), locale)}</span> },
        { key: 'executedQty', header: 'Executed', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtNumber(Number(r.executedQty), locale, 2)}</span> },
      ]}
      fields={[
        { name: 'itemNo', label: 'Item No.', required: true },
        { name: 'description', label: t('common.description'), required: true, colSpan: 2 },
        { name: 'section', label: 'Section' },
        { name: 'unit', label: 'Unit', required: true },
        { name: 'quantity', label: 'Quantity', type: 'number', required: true },
        { name: 'unitRate', label: 'Unit Rate', type: 'number', required: true },
        { name: 'executedQty', label: 'Executed Qty', type: 'number' },
      ]}
    />
  );
}
