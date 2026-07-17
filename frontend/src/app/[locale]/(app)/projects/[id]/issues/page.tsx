'use client';

import { useParams } from 'next/navigation';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { StatusBadge } from '@/components/ui/primitives';
import { fmtDate } from '@/lib/format';

export default function IssuesPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  return (
    <CrudPage
      title={t('nav.issues')}
      queryKey={['issues', id]}
      listPath={`/projects/${id}/issues`}
      createPath={`/projects/${id}/issues`}
      updatePath={(r: any) => `/issues/${r.id}`}
      deletePath={(r: any) => `/issues/${r.id}`}
      searchKeys={['description', 'category']}
      extractList={(d) => d ?? []}
      columns={[
        { key: 'code', header: '#', align: 'end' },
        { key: 'description', header: t('common.description') },
        { key: 'category', header: 'Category' },
        { key: 'priority', header: 'Priority', render: (r: any) => <StatusBadge status={r.priority} /> },
        { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
        { key: 'raisedAt', header: 'Raised', render: (r: any) => fmtDate(r.raisedAt, locale) },
        { key: 'resolvedAt', header: 'Resolved', render: (r: any) => fmtDate(r.resolvedAt, locale) },
        { key: 'resolution', header: 'Resolution / Action', className: 'max-w-xs truncate' },
      ]}
      fields={[
        { name: 'description', label: t('common.description'), required: true, colSpan: 2 },
        { name: 'category', label: 'Category', required: true },
        { name: 'priority', label: 'Priority', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], defaultValue: 'MEDIUM' },
        { name: 'status', label: t('common.status'), type: 'select', options: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED'], defaultValue: 'OPEN' },
        { name: 'raisedAt', label: 'Raised', type: 'date' },
        { name: 'resolution', label: 'Resolution / Action', type: 'textarea', colSpan: 2 },
      ]}
    />
  );
}
