'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const PALETTE = ['#406553', '#c49a4f', '#5b8db8', '#b85b5b', '#7a68a6', '#58a08c', '#b88b5b', '#8898aa'];
const gridStroke = 'rgba(128,128,128,0.15)';

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(128,128,128,0.25)',
  background: 'var(--tooltip-bg, rgba(255,255,255,0.95))',
  fontSize: 12,
};

export function SCurveChart({ data }: { data: Array<{ month: string; pv: number; ev: number | null; ac: number | null }> }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={70} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="pv" name="PV" stroke="#8898aa" strokeWidth={2} dot={false} strokeDasharray="6 3" />
        <Line type="monotone" dataKey="ev" name="EV" stroke="#406553" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="ac" name="AC" stroke="#b85b5b" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BudgetBarChart({
  data,
}: {
  data: Array<{ category: string; budget: number; actual: number; forecast: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={54} />
        <YAxis tick={{ fontSize: 11 }} width={70} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="budget" name="Budget" fill="#8898aa" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="Actual" fill="#406553" radius={[4, 4, 0, 0]} />
        <Bar dataKey="forecast" name="Forecast" fill="#c49a4f" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={92} paddingAngle={3} strokeWidth={0}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CashflowChart({
  data,
}: {
  data: Array<{ month: number; actualIncome: number; actualExpense: number; runningPlanned: number; runningActual: number }>;
}) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const rows = data.map((d) => ({ ...d, label: MONTHS[d.month - 1] }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="cfBalance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#406553" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#406553" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={70} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="runningPlanned" name="Running balance (plan)" stroke="#406553" fill="url(#cfBalance)" strokeWidth={2.5} />
        <Line type="monotone" dataKey="runningActual" name="Running balance (actual)" stroke="#c49a4f" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({
  data, xKey, bars,
}: {
  data: any[];
  xKey: string;
  bars: Array<{ key: string; name: string; color?: string }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={60} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color ?? PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
