'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { StatusBadge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const TABS = [
  { seg: '', key: 'nav.dashboard' },
  { seg: 'schedule', key: 'nav.schedule' },
  { seg: 'budget', key: 'nav.budget' },
  { seg: 'cost-control', key: 'nav.costControl' },
  { seg: 'cashflow', key: 'nav.cashflow' },
  { seg: 'invoices', key: 'nav.invoices' },
  { seg: 'boq', key: 'nav.boq' },
  { seg: 'variations', key: 'nav.variations' },
  { seg: 'procurement', key: 'nav.procurement' },
  { seg: 'materials', key: 'nav.materialRequests' },
  { seg: 'risks', key: 'nav.risks' },
  { seg: 'issues', key: 'nav.issues' },
  { seg: 'quality', key: 'nav.quality' },
  { seg: 'safety', key: 'nav.safety' },
  { seg: 'documents', key: 'nav.documents' },
  { seg: 'daily-reports', key: 'nav.dailyReports' },
  { seg: 'progress-reports', key: 'nav.progressReports' },
  { seg: 'kpis', key: 'nav.kpis' },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n();
  const params = useParams<{ id: string }>();
  const pathname = usePathname();

  const { data: project } = useQuery({
    queryKey: ['project', params.id],
    queryFn: () => get(`/projects/${params.id}`),
  });

  const base = `/${locale}/projects/${params.id}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`/${locale}/projects`} className="text-sm text-zinc-400 hover:text-zinc-600">
          {t('nav.projects')} /
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{project?.name ?? '…'}</h1>
        {project && <StatusBadge status={project.status} />}
        {project?.contractNumber && (
          <span className="rounded-lg bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500 dark:bg-zinc-800">
            {project.contractNumber}
          </span>
        )}
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-surface-muted-dark">
        {TABS.map((tab) => {
          const href = tab.seg ? `${base}/${tab.seg}` : base;
          const active = tab.seg ? pathname?.startsWith(href) : pathname === base;
          return (
            <Link
              key={tab.seg}
              href={href}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800',
              )}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
