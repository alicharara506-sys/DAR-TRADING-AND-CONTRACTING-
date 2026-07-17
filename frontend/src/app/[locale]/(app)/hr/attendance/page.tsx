'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card, StatusBadge } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { fmtDate, fmtNumber } from '@/lib/format';

export default function AttendancePage() {
  const { t, locale } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => get('/hr/attendance'),
  });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('nav.attendance')}</h1>
      <Card>
        <DataTable
          data={data ?? []}
          loading={isLoading}
          searchKeys={['employee.firstName', 'employee.lastName', 'employee.code']}
          pageSize={25}
          dense
          columns={[
            { key: 'date', header: t('common.date'), render: (r: any) => fmtDate(r.date, locale) },
            { key: 'employee', header: t('nav.employees'), render: (r: any) => `${r.employee?.firstName} ${r.employee?.lastName}` },
            { key: 'trade', header: 'Trade', render: (r: any) => r.employee?.trade ?? '—' },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
            { key: 'hoursWorked', header: 'Hours', align: 'end', render: (r: any) => fmtNumber(Number(r.hoursWorked), locale, 1) },
            { key: 'otHours', header: 'OT', align: 'end', render: (r: any) => fmtNumber(Number(r.otHours), locale, 1) },
          ]}
        />
      </Card>
    </div>
  );
}
