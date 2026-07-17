'use client';

import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { fmtDate } from '@/lib/format';

export default function TrainingsPage() {
  const { t, locale } = useI18n();
  return (
    <CrudPage
      title="Safety Training"
      queryKey={['trainings']}
      listPath="/hr/trainings"
      createPath="/hr/trainings"
      searchKeys={['trainingName', 'employee.firstName', 'employee.lastName']}
      extractList={(d) => d ?? []}
      columns={[
        { key: 'employee', header: t('nav.employees'), render: (r: any) => `${r.employee?.firstName} ${r.employee?.lastName}` },
        { key: 'trainingName', header: t('common.name'), render: (r: any) => <span className="font-medium">{r.trainingName}</span> },
        { key: 'provider', header: 'Provider' },
        { key: 'completedAt', header: 'Completed', render: (r: any) => fmtDate(r.completedAt, locale) },
        {
          key: 'expiresAt', header: 'Expires',
          render: (r: any) => {
            if (!r.expiresAt) return '—';
            const expiring = new Date(r.expiresAt) < new Date(Date.now() + 30 * 86400000);
            return <span className={expiring ? 'font-medium text-red-600' : ''}>{fmtDate(r.expiresAt, locale)}</span>;
          },
        },
      ]}
      fields={[
        { name: 'employeeId', label: 'Employee ID', required: true },
        { name: 'trainingName', label: t('common.name'), required: true },
        { name: 'provider', label: 'Provider' },
        { name: 'completedAt', label: 'Completed', type: 'date', required: true },
        { name: 'expiresAt', label: 'Expires', type: 'date' },
      ]}
    />
  );
}
