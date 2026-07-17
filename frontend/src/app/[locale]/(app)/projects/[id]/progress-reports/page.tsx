'use client';

import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Sparkles } from 'lucide-react';
import { get, post } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Button, Card, Spinner, StatusBadge } from '@/components/ui/primitives';
import { fmtCurrency, fmtDate } from '@/lib/format';

export default function ProgressReportsPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['progress-reports', id],
    queryFn: () => get(`/projects/${id}/progress-reports`),
  });

  const generate = useMutation({
    mutationFn: (type: 'WEEKLY' | 'MONTHLY') => post(`/projects/${id}/progress-reports/generate`, { type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['progress-reports', id] }),
  });

  if (isLoading) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('nav.progressReports')}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => generate.mutate('WEEKLY')} loading={generate.isPending}>
            <Sparkles className="h-3.5 w-3.5" /> {t('common.generate')} — {t('nav.reports')} (W)
          </Button>
          <Button size="sm" onClick={() => generate.mutate('MONTHLY')} loading={generate.isPending}>
            <Sparkles className="h-3.5 w-3.5" /> {t('common.generate')} — {t('nav.reports')} (M)
          </Button>
        </div>
      </div>

      {(data ?? []).map((r: any) => (
        <Card
          key={r.id}
          title={
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {r.type} · {fmtDate(r.periodStart, locale)} → {fmtDate(r.periodEnd, locale)}
            </span>
          }
          action={<StatusBadge status={r.status} />}
        >
          <p className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{r.executiveSummary}</p>
          {r.kpis && (
            <div className="mb-4 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
              {[
                ['SPI', r.kpis.spi], ['CPI', r.kpis.cpi],
                ['EV', fmtCurrency(r.kpis.ev, locale)], ['AC', fmtCurrency(r.kpis.ac, locale)],
                ['EAC', fmtCurrency(r.kpis.eac, locale)], ['VAC', fmtCurrency(r.kpis.vac, locale)],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                  <p className="text-sm font-semibold tabular-nums">{value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</p>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Completed / current activities</h4>
              <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                {(r.completedActivities ?? []).map((a: any, i: number) => (
                  <li key={i} className="flex justify-between gap-2 border-b border-zinc-100 py-1 last:border-0 dark:border-zinc-800">
                    <span className="truncate">{a.activity?.trim()}</span>
                    <span className="shrink-0 tabular-nums text-zinc-400">{a.completionPct}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Risks & recommendations</h4>
              <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                {(r.risksAndRecommendations ?? []).slice(0, 6).map((x: any, i: number) => (
                  <li key={i} className="border-b border-zinc-100 py-1 last:border-0 dark:border-zinc-800">
                    <span className="me-2 rounded bg-zinc-100 px-1 py-0.5 text-[9px] uppercase dark:bg-zinc-800">{x.type}</span>
                    {x.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
