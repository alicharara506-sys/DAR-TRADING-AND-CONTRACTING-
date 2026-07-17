'use client';

import Link from 'next/link';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { ProgressBar, StatusBadge } from '@/components/ui/primitives';
import { fmtCurrency, fmtDate } from '@/lib/format';

export default function ProjectsPage() {
  const { t, locale } = useI18n();
  return (
    <CrudPage
      title={t('nav.projects')}
      queryKey={['projects']}
      listPath="/projects?pageSize=200"
      createPath="/projects"
      updatePath={(r: any) => `/projects/${r.id}`}
      deletePath={(r: any) => `/projects/${r.id}`}
      searchKeys={['name', 'code', 'location']}
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        {
          key: 'name',
          header: t('common.name'),
          render: (r: any) => (
            <Link href={`/${locale}/projects/${r.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
              {r.name}
            </Link>
          ),
        },
        { key: 'client', header: t('nav.clients'), render: (r: any) => r.client?.name ?? '—' },
        { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
        { key: 'progressPct', header: t('schedule.progress'), render: (r: any) => <ProgressBar value={Number(r.progressPct)} /> },
        { key: 'startDate', header: t('schedule.start'), render: (r: any) => fmtDate(r.startDate, locale) },
        { key: 'finishDate', header: t('schedule.finish'), render: (r: any) => fmtDate(r.finishDate, locale) },
        {
          key: 'contractValue', header: t('dashboard.contractValue'), align: 'end',
          render: (r: any) => <span className="tabular-nums">{fmtCurrency(Number(r.contractValue), locale, r.currency)}</span>,
        },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true },
        { name: 'name', label: t('common.name'), required: true },
        { name: 'contractNumber', label: 'Contract No.' },
        { name: 'location', label: 'Location' },
        { name: 'startDate', label: t('schedule.start'), type: 'date', required: true },
        { name: 'finishDate', label: t('schedule.finish'), type: 'date', required: true },
        { name: 'contractValue', label: t('dashboard.contractValue'), type: 'number' },
        { name: 'status', label: t('common.status'), type: 'select', options: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'], defaultValue: 'PLANNING' },
        { name: 'vatRate', label: 'VAT Rate', type: 'number', step: '0.01', defaultValue: 0.11 },
        { name: 'retentionRate', label: 'Retention Rate', type: 'number', step: '0.01', defaultValue: 0.1 },
        { name: 'advanceRate', label: 'Advance Rate', type: 'number', step: '0.01', defaultValue: 0.15 },
        { name: 'description', label: t('common.description'), type: 'textarea', colSpan: 2 },
      ]}
    />
  );
}
