'use client';

import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { StatusBadge } from '@/components/ui/primitives';
import { fmtCurrency, fmtPercent } from '@/lib/format';

export default function EquipmentPage() {
  const { t, locale } = useI18n();
  return (
    <CrudPage
      title={t('nav.equipment')}
      queryKey={['equipment']}
      listPath="/equipment"
      createPath="/equipment"
      updatePath={(r: any) => `/equipment/${r.id}`}
      deletePath={(r: any) => `/equipment/${r.id}`}
      searchKeys={['code', 'name', 'type']}
      extractList={(d) => d ?? []}
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: 'name', header: t('common.name'), render: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'ownership', header: 'Ownership', render: (r: any) => <StatusBadge status={r.ownership} /> },
        { key: 'owner', header: 'Owner/Supplier', render: (r: any) => r.owner?.name ?? 'DAR (own plant)' },
        { key: 'dailyRate', header: 'Rate/day', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.dailyRate), locale)}</span> },
        { key: 'plannedCost', header: 'Planned', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(r.plannedCost, locale)}</span> },
        { key: 'actualCost', header: 'Actual', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(r.actualCost, locale)}</span> },
        { key: 'utilization', header: 'Utilisation', align: 'end', render: (r: any) => fmtPercent(r.utilization, locale) },
        { key: 'maintenances', header: 'Maint. due', align: 'end', render: (r: any) => (r.maintenances?.length ? <span className="text-amber-600">{r.maintenances.length}</span> : '—') },
        { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: t('common.name'), required: true },
        { name: 'type', label: 'Type' },
        { name: 'ownership', label: 'Ownership', type: 'select', options: ['OWNED', 'HIRED', 'LEASED'], defaultValue: 'HIRED' },
        { name: 'dailyRate', label: 'Daily rate', type: 'number' },
        { name: 'fuelCostPerDay', label: 'Fuel cost/day', type: 'number' },
        { name: 'status', label: t('common.status'), type: 'select', options: ['AVAILABLE', 'IN_USE', 'UNDER_MAINTENANCE', 'RETURNED', 'DISPOSED'], defaultValue: 'AVAILABLE' },
        { name: 'serialNumber', label: 'Serial number' },
      ]}
    />
  );
}
