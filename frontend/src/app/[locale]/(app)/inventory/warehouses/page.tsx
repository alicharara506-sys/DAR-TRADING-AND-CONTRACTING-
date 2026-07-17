'use client';

import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';

export default function WarehousesPage() {
  const { t } = useI18n();
  return (
    <CrudPage
      title={t('nav.warehouses')}
      queryKey={['warehouses']}
      listPath="/warehouses"
      createPath="/warehouses"
      updatePath={(r: any) => `/warehouses/${r.id}`}
      searchKeys={['code', 'name', 'location']}
      extractList={(d) => d ?? []}
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: 'name', header: t('common.name'), render: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'location', header: 'Location' },
        { key: 'stockLevels', header: 'SKUs', align: 'end', render: (r: any) => r.stockLevels?.filter((s: any) => Number(s.quantity) > 0).length ?? 0 },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: t('common.name'), required: true },
        { name: 'location', label: 'Location' },
      ]}
    />
  );
}
