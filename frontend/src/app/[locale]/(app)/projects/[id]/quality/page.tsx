'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { StatusBadge } from '@/components/ui/primitives';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function QualityPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'ncrs' | 'inspections' | 'ms'>('ncrs');
  const tabs = [
    { id: 'ncrs', label: t('nav.ncrs') },
    { id: 'inspections', label: t('nav.inspections') },
    { id: 'ms', label: t('nav.methodStatements') },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-surface-muted-dark">
        {tabs.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)}
            className={cn('rounded-lg px-3 py-1.5 text-xs font-medium',
              tab === x.id ? 'bg-brand-700 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800')}>
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'ncrs' && (
        <CrudPage
          title={t('nav.ncrs')}
          queryKey={['ncrs', id]}
          listPath={`/projects/${id}/quality/ncrs`}
          createPath={`/projects/${id}/quality/ncrs`}
          updatePath={(r: any) => `/projects/${id}/quality/ncrs/${r.id}`}
          searchKeys={['number', 'description', 'location']}
          extractList={(d) => d ?? []}
          columns={[
            { key: 'number', header: 'NCR #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'description', header: t('common.description'), className: 'max-w-md truncate' },
            { key: 'location', header: 'Location' },
            { key: 'raisedAt', header: 'Raised', render: (r: any) => fmtDate(r.raisedAt, locale) },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
          ]}
          fields={[
            { name: 'description', label: t('common.description'), required: true, colSpan: 2 },
            { name: 'location', label: 'Location' },
            { name: 'raisedAt', label: 'Raised', type: 'date' },
            { name: 'rootCause', label: 'Root cause', type: 'textarea', colSpan: 2 },
            { name: 'correctiveAction', label: 'Corrective action', type: 'textarea', colSpan: 2 },
            { name: 'status', label: t('common.status'), type: 'select', options: ['OPEN', 'UNDER_REVIEW', 'CORRECTIVE_ACTION', 'VERIFIED', 'CLOSED'], defaultValue: 'OPEN' },
          ]}
        />
      )}

      {tab === 'inspections' && (
        <CrudPage
          title={t('nav.inspections')}
          queryKey={['inspections', id]}
          listPath={`/projects/${id}/quality/inspections`}
          createPath={`/projects/${id}/quality/inspections`}
          updatePath={(r: any) => `/projects/${id}/quality/inspections/${r.id}`}
          searchKeys={['number', 'description']}
          extractList={(d) => d ?? []}
          columns={[
            { key: 'number', header: 'IR #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'description', header: t('common.description') },
            { key: 'discipline', header: 'Discipline' },
            { key: 'requestedAt', header: 'Requested', render: (r: any) => fmtDate(r.requestedAt, locale) },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
            { key: 'result', header: 'Result' },
          ]}
          fields={[
            { name: 'description', label: t('common.description'), required: true, colSpan: 2 },
            { name: 'location', label: 'Location' },
            { name: 'discipline', label: 'Discipline', type: 'select', options: ['ARCH', 'STR', 'MEP', 'CIVIL'] },
            { name: 'requestedAt', label: 'Requested', type: 'date' },
            { name: 'status', label: t('common.status'), type: 'select', options: ['REQUESTED', 'SCHEDULED', 'PASSED', 'FAILED', 'CANCELLED'], defaultValue: 'REQUESTED' },
            { name: 'result', label: 'Result' },
          ]}
        />
      )}

      {tab === 'ms' && (
        <CrudPage
          title={t('nav.methodStatements')}
          queryKey={['ms', id]}
          listPath={`/projects/${id}/quality/method-statements`}
          createPath={`/projects/${id}/quality/method-statements`}
          updatePath={(r: any) => `/projects/${id}/quality/method-statements/${r.id}`}
          searchKeys={['number', 'title']}
          extractList={(d) => d ?? []}
          columns={[
            { key: 'number', header: 'MS #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'title', header: t('common.name') },
            { key: 'activity', header: 'Activity' },
            { key: 'submittedAt', header: 'Submitted', render: (r: any) => fmtDate(r.submittedAt, locale) },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
          ]}
          fields={[
            { name: 'title', label: t('common.name'), required: true, colSpan: 2 },
            { name: 'activity', label: 'Activity' },
            { name: 'submittedAt', label: 'Submitted', type: 'date' },
            { name: 'status', label: t('common.status'), type: 'select', options: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'APPROVED_AS_NOTED', 'REVISE_RESUBMIT', 'REJECTED'], defaultValue: 'DRAFT' },
          ]}
        />
      )}
    </div>
  );
}
