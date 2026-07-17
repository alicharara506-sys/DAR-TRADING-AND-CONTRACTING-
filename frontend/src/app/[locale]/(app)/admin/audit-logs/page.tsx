'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card, StatusBadge } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { fmtDateTime } from '@/lib/format';

export default function AuditLogsPage() {
  const { t, locale } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => get('/audit-logs?pageSize=200'),
  });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('nav.auditLogs')}</h1>
      <Card>
        <DataTable
          data={data?.data ?? []}
          loading={isLoading}
          searchKeys={['resource', 'action', 'user.email']}
          pageSize={25}
          dense
          columns={[
            { key: 'createdAt', header: t('common.date'), render: (r: any) => <span className="whitespace-nowrap tabular-nums">{fmtDateTime(r.createdAt, locale)}</span> },
            { key: 'user', header: 'User', render: (r: any) => (r.user ? `${r.user.firstName} ${r.user.lastName}` : 'System') },
            { key: 'action', header: 'Action', render: (r: any) => <StatusBadge status={r.action === 'CREATE' ? 'APPROVED' : r.action === 'DELETE' ? 'REJECTED' : r.action} /> },
            { key: 'resource', header: 'Resource', render: (r: any) => <span className="font-mono text-xs">{r.resource}</span> },
            { key: 'resourceId', header: 'Record', render: (r: any) => <span className="font-mono text-[10px] text-zinc-400">{r.resourceId?.slice(0, 8) ?? '—'}</span> },
            { key: 'ip', header: 'IP' },
          ]}
        />
      </Card>
    </div>
  );
}
