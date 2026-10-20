import { useId, useContext, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Legend,
  ReferenceLine,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Empty } from './ui';
import { fmt } from '../lib/calc';
import { useApp } from '../lib/context';
import { personalisation, weeklyChartData } from '../lib/personalisation';
import { ChartOptionsContext } from './ChartPreferences';
export function TrendChart({
  data,
  unit = '',
  label = 'Progress',
  secondary,
  secondaryLabel = '7-day average',
  color = 'var(--widget-accent, var(--green))',
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
  const gradientId = 'chart-' + useId().replaceAll(':', '');
  const [narrow, setNarrow] = useState(false);
  const { data: appData } = useApp();
  const overrides = useContext(ChartOptionsContext);
  const options = overrides ?? personalisation(appData.settings).charts;
  const grouped = options.aggregation === 'weekly' ? weeklyChartData(data) : undefined;
  const points = grouped ?? data;
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
      aria-label={`${label}: ${points.length} ${grouped ? 'weekly averages' : 'recorded points'}. Latest ${fmt(Number(points[points.length - 1].value))} ${unit}.`}
    >
      <ResponsiveContainer
        width="100%"
        height={narrow ? 180 : 210}
        onResize={(width) => setNarrow(width < 240)}
      >
        <ComposedChart
          data={points}
          margin={{ top: 15, right: narrow ? 6 : 15, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <pattern
              id={gradientId + '-pattern'}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
            >
              <path d="M0 8 8 0" stroke={color} strokeWidth="2" />
              <rect width="8" height="8" fill={color} opacity="0.12" />
            </pattern>
          </defs>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)" />
          <XAxis
            hide={!options.axes}
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: narrow ? 10 : 11, fill: 'var(--muted)' }}
            minTickGap={24}
          />
          <YAxis
            hide={!options.axes}
            width={narrow ? 36 : 48}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: narrow ? 10 : 11, fill: 'var(--muted)' }}
            tickFormatter={(v) => fmt(v, Math.abs(v) < 10 ? 2 : 0)}
            domain={
              zeroBaseline
                ? [0, (max: number) => Math.max(max, options.target ?? 0)]
                : [
                    (min: number) =>
                      Math.max(0, Math.min(min, options.target ?? min) - Math.max(1, min * 0.01)),
                    (max: number) => Math.max(max, options.target ?? 0) + Math.max(1, max * 0.01),
                  ]
            }
          />
          <Tooltip
            itemStyle={{ color: 'var(--ink)' }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontSize: 12,
            }}
            formatter={(v, name) => [`${fmt(Number(v))} ${unit}`, name]}
          />
          {options.legend && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {options.target !== undefined && (
            <ReferenceLine
              y={options.target}
              stroke="var(--muted)"
              strokeDasharray="3 3"
              label={{ value: 'Target', fill: 'var(--muted)', fontSize: 11 }}
            />
          )}
          {options.style === 'bar' ? (
            <Bar
              name={label}
              dataKey="value"
              fill={options.patterns ? `url(#${gradientId}-pattern)` : color}
              isAnimationActive={false}
            />
          ) : (
            <Area
              name={label}
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={
                options.style === 'line'
                  ? 'none'
                  : options.patterns
                    ? `url(#${gradientId}-pattern)`
                    : `url(#${gradientId})`
              }
              dot={{ r: 3, strokeWidth: 2, fill: 'var(--surface)' }}
              isAnimationActive={false}
            />
          )}
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
        </ComposedChart>
      </ResponsiveContainer>
      {options.caption && (
        <p className="chart-caption">
          {points.length} {grouped ? 'weekly averages of recorded points' : 'recorded points'} ·
          latest {fmt(Number(points[points.length - 1].value))} {unit}.{' '}
          {secondary && `Dashed line: ${secondaryLabel}.`}
          {options.aggregation === 'weekly' &&
            !grouped &&
            ' Full dates are unavailable; showing individual records.'}
        </p>
      )}
    </div>
  );
}
