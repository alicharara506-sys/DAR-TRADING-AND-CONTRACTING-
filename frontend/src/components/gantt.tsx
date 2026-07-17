'use client';

import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface GanttTask {
  id: string;
  code: number;
  name: string;
  phase?: string | null;
  plannedStart: string;
  plannedFinish: string;
  progressPct: number;
  status: string;
  isSummary: boolean;
  isCritical: boolean;
  totalFloat?: number | null;
  baseline?: { plannedStart: string; plannedFinish: string } | null;
  responsible?: { firstName: string; lastName: string } | null;
}

interface GanttDep {
  predecessorId: string;
  successorId: string;
}

const ROW_H = 34;
const DAY_W = 3.2;
const LABEL_W = 260;

/**
 * SVG Gantt chart: baseline ghost bars, progress fill, critical-path
 * highlighting, dependency arrows, month grid, today marker.
 */
export function GanttChart({
  tasks,
  dependencies,
  showCriticalOnly,
}: {
  tasks: GanttTask[];
  dependencies: GanttDep[];
  showCriticalOnly?: boolean;
}) {
  const [hover, setHover] = useState<GanttTask | null>(null);

  const visible = useMemo(
    () => (showCriticalOnly ? tasks.filter((t) => t.isCritical || t.isSummary) : tasks),
    [tasks, showCriticalOnly],
  );

  const { min, totalDays, months } = useMemo(() => {
    if (!visible.length) return { min: new Date(), totalDays: 30, months: [] as { label: string; x: number; w: number }[] };
    const starts = visible.map((t) => new Date(t.plannedStart).getTime());
    const ends = visible.map((t) => new Date(t.plannedFinish).getTime());
    const minDate = new Date(Math.min(...starts));
    const maxDate = new Date(Math.max(...ends));
    minDate.setDate(1);
    const total = Math.max(30, differenceInCalendarDays(maxDate, minDate) + 14);
    const monthMarks: { label: string; x: number; w: number }[] = [];
    const cursor = new Date(minDate);
    while (cursor <= maxDate) {
      const start = differenceInCalendarDays(cursor, minDate);
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const width = differenceInCalendarDays(next, cursor);
      monthMarks.push({ label: format(cursor, 'MMM yy'), x: start * DAY_W, w: width * DAY_W });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { min: minDate, totalDays: total, months: monthMarks };
  }, [visible]);

  const xOf = (date: string | Date) => differenceInCalendarDays(new Date(date), min) * DAY_W;
  const chartW = totalDays * DAY_W;
  const chartH = visible.length * ROW_H;
  const todayX = xOf(new Date());
  const rowIndex = new Map(visible.map((t, i) => [t.id, i]));

  return (
    <div className="relative overflow-x-auto">
      <div className="flex" style={{ minWidth: LABEL_W + chartW }}>
        {/* Labels */}
        <div className="sticky start-0 z-10 shrink-0 bg-white dark:bg-surface-muted-dark" style={{ width: LABEL_W }}>
          <div className="h-8 border-b border-zinc-200 dark:border-zinc-800" />
          {visible.map((t) => (
            <div
              key={t.id}
              className={cn(
                'flex items-center gap-2 truncate border-b border-zinc-100 pe-3 text-xs dark:border-zinc-800/60',
                t.isSummary ? 'font-semibold' : 'ps-4 text-zinc-600 dark:text-zinc-300',
              )}
              style={{ height: ROW_H }}
            >
              <span className="w-7 shrink-0 text-end tabular-nums text-zinc-400">{t.code}</span>
              <span className="truncate">{t.name.trim()}</span>
              {t.isCritical && !t.isSummary && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" title="Critical path" />}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="relative">
          {/* Month header */}
          <div className="relative h-8 border-b border-zinc-200 dark:border-zinc-800" style={{ width: chartW }}>
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 flex h-full items-center border-s border-zinc-200 ps-1.5 text-[10px] font-medium uppercase text-zinc-400 dark:border-zinc-800"
                style={{ left: m.x, width: m.w }}
              >
                {m.label}
              </div>
            ))}
          </div>

          <svg width={chartW} height={chartH} role="img" aria-label="Gantt chart">
            {/* month grid */}
            {months.map((m, i) => (
              <line key={i} x1={m.x} x2={m.x} y1={0} y2={chartH} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
            ))}
            {/* row stripes */}
            {visible.map((_, i) => (
              <line key={i} x1={0} x2={chartW} y1={(i + 1) * ROW_H} y2={(i + 1) * ROW_H} className="stroke-zinc-100 dark:stroke-zinc-800/50" strokeWidth={1} />
            ))}

            {/* dependency arrows */}
            {dependencies.map((d, i) => {
              const fromIdx = rowIndex.get(d.predecessorId);
              const toIdx = rowIndex.get(d.successorId);
              if (fromIdx === undefined || toIdx === undefined) return null;
              const from = visible[fromIdx];
              const to = visible[toIdx];
              const x1 = xOf(from.plannedFinish);
              const y1 = fromIdx * ROW_H + ROW_H / 2;
              const x2 = xOf(to.plannedStart);
              const y2 = toIdx * ROW_H + ROW_H / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} L ${x1 + 6} ${y1} L ${x1 + 6} ${y2} L ${x2} ${y2}`}
                  fill="none"
                  className="stroke-zinc-300 dark:stroke-zinc-600"
                  strokeWidth={1}
                  markerEnd="url(#arrow)"
                />
              );
            })}
            <defs>
              <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 8 4 L 0 8 z" className="fill-zinc-300 dark:fill-zinc-600" />
              </marker>
            </defs>

            {/* bars */}
            {visible.map((t, i) => {
              const x = xOf(t.plannedStart);
              const w = Math.max(DAY_W, (differenceInCalendarDays(new Date(t.plannedFinish), new Date(t.plannedStart)) || 1) * DAY_W);
              const y = i * ROW_H + (t.isSummary ? 11 : 8);
              const h = t.isSummary ? 8 : ROW_H - 16;
              const progressW = w * Math.min(1, t.progressPct);
              return (
                <g
                  key={t.id}
                  onMouseEnter={() => setHover(t)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                >
                  {/* baseline ghost */}
                  {t.baseline && !t.isSummary && (
                    <rect
                      x={xOf(t.baseline.plannedStart)}
                      y={y + h + 1}
                      width={Math.max(DAY_W, (differenceInCalendarDays(new Date(t.baseline.plannedFinish), new Date(t.baseline.plannedStart)) || 1) * DAY_W)}
                      height={3}
                      rx={1.5}
                      className="fill-zinc-300 dark:fill-zinc-600"
                    />
                  )}
                  <rect
                    x={x} y={y} width={w} height={h} rx={t.isSummary ? 2 : 4}
                    className={cn(
                      t.isSummary
                        ? 'fill-zinc-500 dark:fill-zinc-400'
                        : t.isCritical
                          ? 'fill-red-200 dark:fill-red-950'
                          : 'fill-brand-100 dark:fill-brand-900',
                    )}
                  />
                  {!t.isSummary && (
                    <rect
                      x={x} y={y} width={progressW} height={h} rx={4}
                      className={t.isCritical ? 'fill-red-500' : 'fill-brand-600'}
                    />
                  )}
                </g>
              );
            })}

            {/* today line */}
            {todayX > 0 && todayX < chartW && (
              <line x1={todayX} x2={todayX} y1={0} y2={chartH} className="stroke-gold-500" strokeWidth={1.5} strokeDasharray="4 3" />
            )}
          </svg>
        </div>
      </div>

      {/* Tooltip */}
      {hover && (
        <div className="pointer-events-none fixed bottom-6 end-6 z-50 w-72 rounded-xl border border-zinc-200 bg-white p-4 text-xs shadow-glass dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-1 font-semibold">{hover.name.trim()}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-zinc-500 dark:text-zinc-400">
            <span>Start</span><span className="text-end tabular-nums">{format(new Date(hover.plannedStart), 'dd MMM yyyy')}</span>
            <span>Finish</span><span className="text-end tabular-nums">{format(new Date(hover.plannedFinish), 'dd MMM yyyy')}</span>
            <span>Progress</span><span className="text-end tabular-nums">{Math.round(hover.progressPct * 100)}%</span>
            <span>Status</span><span className="text-end">{hover.status.replace(/_/g, ' ')}</span>
            {hover.totalFloat !== null && hover.totalFloat !== undefined && (
              <>
                <span>Total float</span><span className="text-end tabular-nums">{hover.totalFloat}d</span>
              </>
            )}
            {hover.responsible && (
              <>
                <span>Responsible</span>
                <span className="text-end">{hover.responsible.firstName} {hover.responsible.lastName}</span>
              </>
            )}
          </div>
          {hover.isCritical && <p className="mt-2 font-medium text-red-500">● Critical path activity</p>}
        </div>
      )}
    </div>
  );
}
