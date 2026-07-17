'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { CrudPage } from '@/components/crud-page';
import { Card, StatusBadge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export default function RisksPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data: matrix } = useQuery({
    queryKey: ['risk-matrix', id],
    queryFn: () => get(`/projects/${id}/risks/matrix`),
  });

  return (
    <div className="space-y-6">
      {matrix && (
        <Card title="Probability × Impact heat map">
          <div className="grid max-w-md grid-cols-3 gap-1.5">
            {matrix.matrix.map((cell: any, i: number) => {
              const severity = { LOW: 1, MEDIUM: 2, HIGH: 3 };
              const score = (severity as any)[cell.probability] * (severity as any)[cell.impact];
              return (
                <div
                  key={i}
                  title={cell.risks.map((r: any) => r.description).join('\n')}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center rounded-xl text-xs',
                    score >= 6 ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      : score >= 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                  )}
                >
                  <span className="text-lg font-semibold">{cell.count}</span>
                  <span className="text-[9px] uppercase">{cell.probability[0]}×{cell.impact[0]}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <CrudPage
        title={t('nav.risks')}
        queryKey={['risks', id]}
        listPath={`/projects/${id}/risks`}
        createPath={`/projects/${id}/risks`}
        updatePath={(r: any) => `/risks/${r.id}`}
        deletePath={(r: any) => `/risks/${r.id}`}
        searchKeys={['description', 'category']}
        extractList={(d) => d ?? []}
        columns={[
          { key: 'code', header: '#', align: 'end' },
          { key: 'description', header: t('common.description') },
          { key: 'category', header: 'Category' },
          { key: 'probability', header: 'Prob.', render: (r: any) => <StatusBadge status={r.probability} /> },
          { key: 'impact', header: 'Impact', render: (r: any) => <StatusBadge status={r.impact} /> },
          {
            key: 'score', header: 'Score', align: 'center',
            render: (r: any) => (
              <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold',
                r.score >= 6 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                : r.score >= 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300')}>
                {r.score}
              </span>
            ),
          },
          { key: 'mitigation', header: 'Mitigation', className: 'max-w-xs truncate' },
          { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
        ]}
        fields={[
          { name: 'description', label: t('common.description'), required: true, colSpan: 2 },
          { name: 'category', label: 'Category', required: true },
          { name: 'probability', label: 'Probability', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH'], defaultValue: 'MEDIUM' },
          { name: 'impact', label: 'Impact', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH'], defaultValue: 'MEDIUM' },
          { name: 'mitigation', label: 'Mitigation', type: 'textarea', colSpan: 2 },
          { name: 'status', label: t('common.status'), type: 'select', options: ['IDENTIFIED', 'ACTIVE', 'MONITOR', 'MITIGATED', 'CLOSED'], defaultValue: 'IDENTIFIED' },
        ]}
      />
    </div>
  );
}
