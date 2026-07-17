'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { StatusBadge } from '@/components/ui/primitives';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function DocumentsPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'drawings' | 'rfis' | 'submittals'>('drawings');
  const tabs = [
    { id: 'drawings', label: t('nav.drawings') },
    { id: 'rfis', label: t('nav.rfis') },
    { id: 'submittals', label: t('nav.submittals') },
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

      {tab === 'drawings' && (
        <CrudPage
          title={t('nav.drawings')}
          queryKey={['drawings', id]}
          listPath={`/projects/${id}/drawings`}
          createPath={`/projects/${id}/drawings`}
          updatePath={(r: any) => `/drawings/${r.id}`}
          searchKeys={['number', 'title', 'discipline']}
          extractList={(d) => d ?? []}
          columns={[
            { key: 'number', header: 'Dwg #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'title', header: t('common.name') },
            { key: 'discipline', header: 'Discipline' },
            { key: 'revision', header: 'Rev', align: 'center' },
            { key: 'issueDate', header: 'Issued', render: (r: any) => fmtDate(r.issueDate, locale) },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
          ]}
          fields={[
            { name: 'number', label: 'Drawing #', required: true },
            { name: 'title', label: t('common.name'), required: true },
            { name: 'discipline', label: 'Discipline', type: 'select', options: ['ARCH', 'STR', 'MEP', 'CIVIL'], required: true },
            { name: 'revision', label: 'Revision', defaultValue: '0' },
            { name: 'issueDate', label: 'Issue date', type: 'date' },
            { name: 'status', label: t('common.status'), type: 'select', options: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'APPROVED_AS_NOTED', 'REVISE_RESUBMIT', 'REJECTED'], defaultValue: 'DRAFT' },
          ]}
        />
      )}

      {tab === 'rfis' && (
        <CrudPage
          title={t('nav.rfis')}
          queryKey={['rfis', id]}
          listPath={`/projects/${id}/rfis`}
          createPath={`/projects/${id}/rfis`}
          updatePath={(r: any) => `/rfis/${r.id}`}
          searchKeys={['number', 'subject']}
          extractList={(d) => d ?? []}
          columns={[
            { key: 'number', header: 'RFI #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'subject', header: 'Subject' },
            { key: 'raisedAt', header: 'Raised', render: (r: any) => fmtDate(r.raisedAt, locale) },
            { key: 'dueDate', header: 'Due', render: (r: any) => fmtDate(r.dueDate, locale) },
            { key: 'answeredAt', header: 'Answered', render: (r: any) => fmtDate(r.answeredAt, locale) },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
          ]}
          fields={[
            { name: 'subject', label: 'Subject', required: true, colSpan: 2 },
            { name: 'question', label: 'Question', type: 'textarea', required: true, colSpan: 2 },
            { name: 'answer', label: 'Answer', type: 'textarea', colSpan: 2 },
            { name: 'raisedAt', label: 'Raised', type: 'date' },
            { name: 'dueDate', label: 'Due', type: 'date' },
            { name: 'status', label: t('common.status'), type: 'select', options: ['OPEN', 'ANSWERED', 'CLOSED', 'OVERDUE'], defaultValue: 'OPEN' },
          ]}
        />
      )}

      {tab === 'submittals' && (
        <CrudPage
          title={t('nav.submittals')}
          queryKey={['submittals', id]}
          listPath={`/projects/${id}/submittals`}
          createPath={`/projects/${id}/submittals`}
          updatePath={(r: any) => `/submittals/${r.id}`}
          searchKeys={['number', 'title']}
          extractList={(d) => d ?? []}
          columns={[
            { key: 'number', header: 'Sub #', render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
            { key: 'title', header: t('common.name') },
            { key: 'type', header: 'Type' },
            { key: 'submittedAt', header: 'Submitted', render: (r: any) => fmtDate(r.submittedAt, locale) },
            { key: 'respondedAt', header: 'Responded', render: (r: any) => fmtDate(r.respondedAt, locale) },
            { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
          ]}
          fields={[
            { name: 'title', label: t('common.name'), required: true, colSpan: 2 },
            { name: 'type', label: 'Type', type: 'select', options: ['MATERIAL', 'SHOP_DRAWING', 'METHOD', 'OTHER'], required: true },
            { name: 'submittedAt', label: 'Submitted', type: 'date' },
            { name: 'status', label: t('common.status'), type: 'select', options: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'APPROVED_AS_NOTED', 'REVISE_RESUBMIT', 'REJECTED'], defaultValue: 'DRAFT' },
          ]}
        />
      )}
    </div>
  );
}
