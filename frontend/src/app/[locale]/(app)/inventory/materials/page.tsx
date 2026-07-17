'use client';

import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { fmtCurrency, fmtNumber } from '@/lib/format';

export default function MaterialsPage() {
  const { t, locale } = useI18n();
  return (
    <CrudPage
      title={t('nav.materials')}
      queryKey={['materials']}
      listPath="/materials"
      createPath="/materials"
      updatePath={(r: any) => `/materials/${r.id}`}
      deletePath={(r: any) => `/materials/${r.id}`}
      searchKeys={['code', 'name', 'category']}
      extractList={(d) => d ?? []}
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: 'name', header: t('common.name'), render: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'unit', header: 'Unit', align: 'center' },
        { key: 'defaultSupplier', header: t('nav.suppliers'), render: (r: any) => r.defaultSupplier?.name ?? '—' },
        { key: 'totalStock', header: 'In stock', align: 'end', render: (r: any) => <span className={`tabular-nums ${r.belowReorder ? 'font-semibold text-red-600' : ''}`}>{fmtNumber(r.totalStock, locale, 1)}</span>, sortValue: (r: any) => r.totalStock },
        { key: 'totalUsed', header: 'Used', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtNumber(r.totalUsed, locale, 1)}</span> },
        { key: 'unitCost', header: 'Unit cost', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.unitCost), locale)}</span> },
        { key: 'stockValue', header: 'Stock value', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(r.stockValue, locale)}</span>, sortValue: (r: any) => r.stockValue },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: t('common.name'), required: true },
        { name: 'unit', label: 'Unit', required: true },
        { name: 'category', label: 'Category' },
        { name: 'unitCost', label: 'Unit cost', type: 'number' },
        { name: 'reorderLevel', label: 'Reorder level', type: 'number' },
      ]}
    />
  );
}
