'use client';

import { useParams } from 'next/navigation';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { fmtCurrency } from '@/lib/format';

export default function BudgetPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  return (
    <CrudPage
      title={t('nav.budget')}
      queryKey={['budget', id]}
      listPath={`/projects/${id}/finance/budget`}
      createPath={`/projects/${id}/finance/budget`}
      updatePath={(r: any) => `/finance/budget/${r.id}`}
      deletePath={(r: any) => `/finance/budget/${r.id}`}
      searchKeys={['description', 'costCode.code']}
      extractList={(d) => d ?? []}
      columns={[
        { key: 'costCode', header: 'Cost Code', render: (r: any) => <span className="font-mono text-xs">{r.costCode?.code}</span> },
        { key: 'description', header: t('common.description') },
        { key: 'originalBudget', header: 'Original', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.originalBudget), locale)}</span> },
        { key: 'revisedBudget', header: 'Revised', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.revisedBudget), locale)}</span> },
        { key: 'forecastCost', header: 'Forecast (EAC)', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.forecastCost), locale)}</span> },
      ]}
      fields={[
        { name: 'costCodeId', label: 'Cost Code ID', required: true },
        { name: 'description', label: t('common.description'), required: true },
        { name: 'originalBudget', label: 'Original Budget', type: 'number', required: true },
        { name: 'revisedBudget', label: 'Revised Budget', type: 'number' },
        { name: 'forecastCost', label: 'Forecast', type: 'number' },
      ]}
    />
  );
}
