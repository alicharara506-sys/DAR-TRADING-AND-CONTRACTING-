'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { Kpi, StatusBadge } from '@/components/ui/primitives';
import { fmtDate, fmtNumber } from '@/lib/format';

export default function SafetyPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data: s } = useQuery({
    queryKey: ['safety-summary', id],
    queryFn: () => get(`/projects/${id}/safety/summary`),
  });

  return (
    <div className="space-y-6">
      {s && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <Kpi label="Total incidents" value={fmtNumber(s.totalIncidents, locale)} />
          <Kpi label="LTI count" value={fmtNumber(s.ltiCount, locale)} tone={s.ltiCount > 0 ? 'bad' : 'good'} />
          <Kpi label="LTIFR (per 1M hrs)" value={s.ltifr ?? '—'} />
          <Kpi label="Days since last LTI" value={s.daysSinceLastLti ?? '—'} tone="good" />
          <Kpi label="Toolbox talks" value={fmtNumber(s.toolboxTalks, locale)} />
        </div>
      )}
      <CrudPage
        title={t('nav.incidents')}
        queryKey={['incidents', id]}
        listPath={`/projects/${id}/safety/incidents`}
        createPath={`/projects/${id}/safety/incidents`}
        updatePath={(r: any) => `/projects/${id}/safety/incidents/${r.id}`}
        searchKeys={['description', 'location']}
        extractList={(d) => d ?? []}
        columns={[
          { key: 'date', header: t('common.date'), render: (r: any) => fmtDate(r.date, locale) },
          { key: 'severity', header: 'Severity', render: (r: any) => <StatusBadge status={r.severity} /> },
          { key: 'description', header: t('common.description'), className: 'max-w-md truncate' },
          { key: 'location', header: 'Location' },
          { key: 'isLti', header: 'LTI', align: 'center', render: (r: any) => (r.isLti ? '⚠' : '—') },
        ]}
        fields={[
          { name: 'date', label: t('common.date'), type: 'date', required: true },
          { name: 'severity', label: 'Severity', type: 'select', options: ['NEAR_MISS', 'FIRST_AID', 'MEDICAL_TREATMENT', 'LOST_TIME', 'FATALITY'], defaultValue: 'NEAR_MISS' },
          { name: 'description', label: t('common.description'), required: true, colSpan: 2 },
          { name: 'location', label: 'Location' },
          { name: 'actionTaken', label: 'Action taken', type: 'textarea', colSpan: 2 },
        ]}
      />
    </div>
  );
}
