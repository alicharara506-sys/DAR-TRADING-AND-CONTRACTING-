'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { get, post } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Button, Card, Input, Label, Modal, Spinner, StatusBadge } from '@/components/ui/primitives';
import { fmtCurrency, fmtNumber } from '@/lib/format';

export default function PayrollPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [genOpen, setGenOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({ queryKey: ['payroll'], queryFn: () => get('/hr/payroll') });

  const generate = useMutation({
    mutationFn: () => post('/hr/payroll/generate', { year: Number(year), month: Number(month) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
      setGenOpen(false);
    },
  });
  const approve = useMutation({
    mutationFn: (id: string) => post(`/hr/payroll/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll'] }),
  });

  if (isLoading) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.payroll')}</h1>
        <Button onClick={() => setGenOpen(true)}>
          <Sparkles className="h-4 w-4" /> {t('common.generate')}
        </Button>
      </div>

      {(data ?? []).map((run: any) => {
        const total = run.items.reduce((s: number, i: any) => s + Number(i.netPay), 0);
        return (
          <Card
            key={run.id}
            title={`${run.year}-${String(run.month).padStart(2, '0')} — ${fmtCurrency(total, locale)}`}
            action={
              <div className="flex items-center gap-2">
                <StatusBadge status={run.status} />
                {run.status === 'DRAFT' && (
                  <Button size="sm" variant="secondary" onClick={() => approve.mutate(run.id)} loading={approve.isPending}>
                    {t('common.approve')}
                  </Button>
                )}
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 dark:border-zinc-800">
                    <th className="px-3 py-2 text-start">{t('nav.employees')}</th>
                    <th className="px-3 py-2 text-start">Position</th>
                    <th className="px-3 py-2 text-end">Days</th>
                    <th className="px-3 py-2 text-end">OT hrs</th>
                    <th className="px-3 py-2 text-end">Basic</th>
                    <th className="px-3 py-2 text-end">OT pay</th>
                    <th className="px-3 py-2 text-end">Net pay</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {run.items.map((i: any) => (
                    <tr key={i.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                      <td className="px-3 py-1.5">{i.employee?.firstName} {i.employee?.lastName}</td>
                      <td className="px-3 py-1.5 text-zinc-500">{i.employee?.position}</td>
                      <td className="px-3 py-1.5 text-end">{i.workingDays}</td>
                      <td className="px-3 py-1.5 text-end">{fmtNumber(Number(i.otHours), locale, 1)}</td>
                      <td className="px-3 py-1.5 text-end">{fmtCurrency(Number(i.basicPay), locale)}</td>
                      <td className="px-3 py-1.5 text-end">{fmtCurrency(Number(i.otPay), locale)}</td>
                      <td className="px-3 py-1.5 text-end font-medium">{fmtCurrency(Number(i.netPay), locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title={`${t('common.generate')} — ${t('nav.payroll')}`}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label>Month</Label>
            <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Payroll is computed from attendance: basic = daily rate × days present; OT = OT hours × OT rate.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setGenOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => generate.mutate()} loading={generate.isPending}>{t('common.generate')}</Button>
        </div>
      </Modal>
    </div>
  );
}
