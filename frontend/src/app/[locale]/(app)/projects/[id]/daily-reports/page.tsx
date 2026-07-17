'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card, Spinner, StatusBadge } from '@/components/ui/primitives';
import { fmtDate } from '@/lib/format';

export default function DailyReportsPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['daily-reports', id],
    queryFn: () => get(`/projects/${id}/daily-reports`),
  });
  const { data: productivity } = useQuery({
    queryKey: ['productivity', id],
    queryFn: () => get(`/projects/${id}/productivity`),
  });

  if (isLoading) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {productivity?.averageAttendanceRate ? (
        <Card title="Productivity — planned vs actual manpower (30 days)">
          <p className="text-sm text-zinc-500">
            Average attendance rate: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{Math.round(productivity.averageAttendanceRate * 100)}%</span>
          </p>
        </Card>
      ) : null}
      {(data ?? []).map((r: any) => (
        <Card
          key={r.id}
          title={`${fmtDate(r.date, locale)} — ${r.weather?.replace(/_/g, ' ')} ${r.temperature ?? ''}`}
          action={<StatusBadge status={r.status} />}
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Manpower</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-400">
                    <th className="pb-1 text-start">Trade</th>
                    <th className="pb-1 text-end">Plan</th>
                    <th className="pb-1 text-end">Actual</th>
                    <th className="pb-1 text-end">Absent</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {r.manpowerLines.map((l: any) => (
                    <tr key={l.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1">{l.trade}</td>
                      <td className="py-1 text-end">{l.planned}</td>
                      <td className="py-1 text-end">{l.actual}</td>
                      <td className={`py-1 text-end ${l.absent > 0 ? 'text-red-500' : ''}`}>{l.absent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Equipment</h4>
              <table className="w-full text-xs">
                <tbody>
                  {r.equipmentLines.map((l: any) => (
                    <tr key={l.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1">{l.equipmentName}</td>
                      <td className="py-1">{l.status}</td>
                      <td className="py-1 text-end tabular-nums">{Number(l.hoursUsed)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <h4 className="mb-1 font-semibold uppercase tracking-wider text-zinc-400">Work completed</h4>
                <p className="whitespace-pre-line text-zinc-600 dark:text-zinc-300">{r.workCompleted}</p>
              </div>
              {r.delays && (
                <div>
                  <h4 className="mb-1 font-semibold uppercase tracking-wider text-zinc-400">Delays</h4>
                  <p className="text-amber-600">{r.delays}</p>
                </div>
              )}
              {r.safetyNotes && (
                <div>
                  <h4 className="mb-1 font-semibold uppercase tracking-wider text-zinc-400">Safety</h4>
                  <p className="text-zinc-600 dark:text-zinc-300">{r.safetyNotes}</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
