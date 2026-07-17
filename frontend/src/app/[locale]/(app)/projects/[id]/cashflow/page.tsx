'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useI18n } from '@/components/providers';
import { Card, Kpi, Spinner } from '@/components/ui/primitives';
import { CashflowChart } from '@/components/charts';
import { fmtCurrency } from '@/lib/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CashflowPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['cashflow', id],
    queryFn: () => get(`/projects/${id}/finance/cashflow`),
  });

  if (isLoading || !data) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Planned income" value={fmtCurrency(data.insights.totalPlannedIncome, locale)} tone="good" />
        <Kpi label="Planned expenditure" value={fmtCurrency(data.insights.totalPlannedExpense, locale)} />
        <Kpi label="Peak negative balance" value={fmtCurrency(data.insights.peakNegativeBalance, locale)} tone="bad" sub={`${MONTHS[data.insights.peakNegativeMonth - 1]} ${data.year}`} />
        <Kpi label="Financing need" value={fmtCurrency(Math.abs(Math.min(0, data.insights.peakNegativeBalance)), locale)} tone="warn" />
      </div>

      <Card title={`${t('nav.cashflow')} ${data.year}`}>
        <CashflowChart data={data.rows} />
      </Card>

      <Card title="Monthly detail">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-start uppercase tracking-wider text-zinc-400 dark:border-zinc-800">
                <th className="px-3 py-2 text-start">#</th>
                {MONTHS.map((m) => <th key={m} className="px-3 py-2 text-end">{m}</th>)}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[
                ['Income (plan)', (r: any) => r.plannedIncome],
                ['Income (actual)', (r: any) => r.actualIncome],
                ['Expense (plan)', (r: any) => r.plannedExpense],
                ['Expense (actual)', (r: any) => r.actualExpense],
                ['Net (plan)', (r: any) => r.netPlanned],
                ['Running balance', (r: any) => r.runningPlanned],
              ].map(([label, fn]: any) => (
                <tr key={label} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{label}</td>
                  {data.rows.map((r: any) => {
                    const v = fn(r);
                    return (
                      <td key={r.month} className={`px-3 py-2 text-end ${v < 0 ? 'text-red-500' : ''}`}>
                        {fmtCurrency(v, locale).replace('US', '')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
