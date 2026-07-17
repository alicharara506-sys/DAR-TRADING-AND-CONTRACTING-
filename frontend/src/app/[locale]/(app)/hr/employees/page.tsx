'use client';

import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { fmtCurrency } from '@/lib/format';

export default function EmployeesPage() {
  const { t, locale } = useI18n();
  return (
    <CrudPage
      title={t('nav.employees')}
      queryKey={['employees']}
      listPath="/hr/employees"
      createPath="/hr/employees"
      updatePath={(r: any) => `/hr/employees/${r.id}`}
      deletePath={(r: any) => `/hr/employees/${r.id}`}
      searchKeys={['code', 'firstName', 'lastName', 'position', 'department']}
      extractList={(d) => d ?? []}
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: 'firstName', header: t('common.name'), render: (r: any) => <span className="font-medium">{r.firstName} {r.lastName}</span> },
        { key: 'position', header: 'Position' },
        { key: 'department', header: 'Department' },
        { key: 'trade', header: 'Trade' },
        { key: 'dailyRate', header: 'Daily rate', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.dailyRate), locale)}</span> },
        { key: 'otRate', header: 'OT rate/hr', align: 'end', render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.otRate), locale)}</span> },
        { key: 'isSubcontracted', header: 'Sub?', align: 'center', render: (r: any) => (r.isSubcontracted ? t('common.yes') : '—') },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'firstName', label: 'First name', required: true },
        { name: 'lastName', label: 'Last name', required: true },
        { name: 'position', label: 'Position', required: true },
        { name: 'department', label: 'Department', type: 'select', options: ['Management', 'Engineering', 'Commercial', 'Finance', 'Operations', 'Labour', 'Subcontract'], required: true },
        { name: 'trade', label: 'Trade' },
        { name: 'dailyRate', label: 'Daily rate', type: 'number' },
        { name: 'otRate', label: 'OT rate/hour', type: 'number' },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'hireDate', label: 'Hire date', type: 'date' },
        { name: 'isSubcontracted', label: 'Subcontracted', type: 'checkbox' },
      ]}
    />
  );
}
