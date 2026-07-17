'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, GitBranch, Play, Save } from 'lucide-react';
import { get, post } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Button, Card, Modal, ProgressBar, Spinner, StatusBadge } from '@/components/ui/primitives';
import { DataTable } from '@/components/data-table';
import { GanttChart } from '@/components/gantt';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function SchedulePage() {
  const { t, locale } = useI18n();
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [view, setView] = useState<'gantt' | 'table' | 'delays'>('gantt');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [cpmResult, setCpmResult] = useState<any>(null);

  const { data: gantt, isLoading } = useQuery({
    queryKey: ['gantt', params.id],
    queryFn: () => get(`/projects/${params.id}/schedule/gantt`),
  });
  const { data: delays } = useQuery({
    queryKey: ['delays', params.id],
    queryFn: () => get(`/projects/${params.id}/schedule/delay-analysis`),
    enabled: view === 'delays',
  });

  const runCpm = useMutation({
    mutationFn: () => post(`/projects/${params.id}/schedule/cpm/run`),
    onSuccess: (result) => {
      setCpmResult(result);
      qc.invalidateQueries({ queryKey: ['gantt', params.id] });
    },
  });
  const saveBaseline = useMutation({
    mutationFn: () => post(`/projects/${params.id}/schedule/baselines`, { name: `Baseline ${new Date().toISOString().slice(0, 10)}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gantt', params.id] }),
  });

  if (isLoading || !gantt) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const tabs = [
    { id: 'gantt', label: t('schedule.gantt') },
    { id: 'table', label: t('schedule.taskList') },
    { id: 'delays', label: t('schedule.delayAnalysis') },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-surface-muted-dark">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                view === tab.id ? 'bg-brand-700 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={(e) => setCriticalOnly(e.target.checked)}
              className="h-4 w-4 rounded accent-red-500"
            />
            {t('schedule.criticalPath')}
          </label>
          <Button size="sm" variant="secondary" onClick={() => saveBaseline.mutate()} loading={saveBaseline.isPending}>
            <Save className="h-3.5 w-3.5" /> {t('schedule.saveBaseline')}
          </Button>
          <Button size="sm" onClick={() => runCpm.mutate()} loading={runCpm.isPending}>
            <Play className="h-3.5 w-3.5" /> {t('schedule.runCpm')}
          </Button>
        </div>
      </div>

      {view === 'gantt' && (
        <Card>
          <GanttChart tasks={gantt.tasks} dependencies={gantt.dependencies} showCriticalOnly={criticalOnly} />
        </Card>
      )}

      {view === 'table' && (
        <Card>
          <DataTable
            data={criticalOnly ? gantt.tasks.filter((x: any) => x.isCritical) : gantt.tasks}
            searchKeys={['name', 'phase']}
            dense
            pageSize={25}
            columns={[
              { key: 'code', header: 'ID', align: 'end', render: (r: any) => <span className="tabular-nums text-zinc-400">{r.code}</span> },
              {
                key: 'name', header: t('common.name'),
                render: (r: any) => (
                  <span className={cn(r.isSummary && 'font-semibold')}>
                    {r.name.trim()}
                    {r.isCritical && !r.isSummary && <AlertTriangle className="ms-1.5 inline h-3 w-3 text-red-500" />}
                  </span>
                ),
              },
              { key: 'phase', header: 'Phase' },
              { key: 'plannedStart', header: t('schedule.start'), render: (r: any) => fmtDate(r.plannedStart, locale) },
              { key: 'plannedFinish', header: t('schedule.finish'), render: (r: any) => fmtDate(r.plannedFinish, locale) },
              { key: 'durationDays', header: t('schedule.duration'), align: 'end', render: (r: any) => `${r.durationDays}d` },
              { key: 'progressPct', header: t('schedule.progress'), render: (r: any) => <ProgressBar value={r.progressPct} critical={r.isCritical} /> },
              { key: 'totalFloat', header: t('schedule.float'), align: 'end', render: (r: any) => (r.totalFloat === null ? '—' : `${r.totalFloat}d`) },
              { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
              {
                key: 'responsible', header: 'Responsible',
                render: (r: any) => (r.responsible ? `${r.responsible.firstName} ${r.responsible.lastName}` : '—'),
              },
            ]}
          />
        </Card>
      )}

      {view === 'delays' && delays && (
        <Card
          title={`${t('schedule.delayAnalysis')} — ${delays.delayedCount}/${delays.totalTasks}`}
          action={
            delays.criticalDelayed > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                <GitBranch className="h-3.5 w-3.5" /> {delays.criticalDelayed} {t('schedule.critical')}
              </span>
            )
          }
        >
          <DataTable
            data={delays.delayedTasks}
            searchKeys={['name']}
            columns={[
              { key: 'code', header: 'ID', align: 'end' },
              { key: 'name', header: t('common.name'), render: (r: any) => r.name.trim() },
              { key: 'slippageDays', header: 'Slippage', align: 'end', render: (r: any) => <span className="font-medium text-red-600">{r.slippageDays}d</span> },
              { key: 'expectedProgress', header: 'Expected %', align: 'end', render: (r: any) => `${Math.round(r.expectedProgress * 100)}%` },
              { key: 'progressPct', header: 'Actual %', align: 'end', render: (r: any) => `${Math.round(r.progressPct * 100)}%` },
              { key: 'isCritical', header: t('schedule.critical'), align: 'center', render: (r: any) => (r.isCritical ? '⚠' : '') },
              { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
            ]}
          />
        </Card>
      )}

      <Modal open={!!cpmResult} onClose={() => setCpmResult(null)} title={t('schedule.runCpm')}>
        {cpmResult && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <p className="text-2xl font-semibold tabular-nums">{cpmResult.projectDurationDays}</p>
              <p className="mt-1 text-xs text-zinc-500">{t('schedule.totalDuration')} ({t('schedule.days')})</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <p className="text-2xl font-semibold tabular-nums">{fmtDate(cpmResult.forecastFinish, locale)}</p>
              <p className="mt-1 text-xs text-zinc-500">{t('schedule.forecastFinish')}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <p className="text-2xl font-semibold tabular-nums text-red-500">{cpmResult.criticalTaskCount}</p>
              <p className="mt-1 text-xs text-zinc-500">{t('schedule.criticalPath')}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
