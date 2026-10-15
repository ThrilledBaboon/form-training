import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Empty } from './ui';
import { fmt } from '../lib/calc';
export function TrendChart({
  data,
  unit = '',
  label = 'Progress',
  secondary,
  secondaryLabel = '7-day average',
  color = '#4d8069',
  zeroBaseline = true,
}: {
  data: Record<string, string | number>[];
  unit?: string;
  label?: string;
  secondary?: string;
  secondaryLabel?: string;
  color?: string;
  zeroBaseline?: boolean;
}) {
  if (!data.length)
    return (
      <Empty title="Your progress starts here" compact>
        Log your first session to see real training data in this chart.
      </Empty>
    );
  return (
    <div
      className="chart-wrap"
      role="img"
      aria-label={`${label}: ${data.length} recorded points. Latest ${fmt(Number(data[data.length - 1].value))} ${unit}.`}
    >
      <ResponsiveContainer width="100%" height={210}>
        <AreaChart data={data} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={'chart-' + label.replaceAll(/\W/g, '')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            minTickGap={24}
          />
          <YAxis
            width={48}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            tickFormatter={(v) => fmt(v, Math.abs(v) < 10 ? 2 : 0)}
            domain={
              zeroBaseline
                ? [0, 'auto']
                : [
                    (min: number) => Math.max(0, min - Math.max(1, min * 0.01)),
                    (max: number) => max + Math.max(1, max * 0.01),
                  ]
            }
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontSize: 12,
            }}
            formatter={(v, name) => [`${fmt(Number(v))} ${unit}`, name]}
          />
          <Area
            name={label}
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#chart-${label.replaceAll(/\W/g, '')})`}
            dot={{ r: 3, strokeWidth: 2, fill: 'var(--surface)' }}
            isAnimationActive={false}
          />
          {secondary && (
            <Line
              name={secondaryLabel}
              type="monotone"
              dataKey={secondary}
              stroke="#b28b54"
              dot={false}
              strokeWidth={2}
              strokeDasharray="4 4"
              isAnimationActive={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      <p className="chart-caption">
        {data.length} recorded points · latest {fmt(Number(data[data.length - 1].value))} {unit}.{' '}
        {secondary && 'Dashed line: moving average.'}
      </p>
    </div>
  );
}
