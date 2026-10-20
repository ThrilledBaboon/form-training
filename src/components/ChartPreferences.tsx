import { createContext } from 'react';
import type { ChartOptions } from '../lib/personalisation';
import { Field } from './ui';
export const ChartOptionsContext = createContext<ChartOptions | undefined>(undefined);
export function ChartPreferences({
  value,
  onChange,
}: {
  value: ChartOptions;
  onChange: (v: ChartOptions) => void;
}) {
  return (
    <>
      <div className="form-grid">
        <Field label="Chart style">
          <select
            value={value.style}
            onChange={(e) => onChange({ ...value, style: e.target.value as ChartOptions['style'] })}
          >
            <option value="area">Filled line</option>
            <option value="line">Line</option>
            <option value="bar">Bars</option>
          </select>
        </Field>
        <Field label="Chart points">
          <select
            value={value.aggregation}
            onChange={(e) =>
              onChange({ ...value, aggregation: e.target.value as ChartOptions['aggregation'] })
            }
          >
            <option value="records">Individual records</option>
            <option value="weekly">Weekly averages of recorded points</option>
          </select>
        </Field>
        <Field label="Chart target line (optional)" hint="Uses the chart's displayed unit.">
          <input
            type="number"
            min={0}
            max={1e12}
            step="any"
            value={value.target ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                target: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        </Field>
      </div>
      {(
        [
          ['axes', 'Show chart axes'],
          ['legend', 'Show chart legend'],
          ['caption', 'Show chart caption'],
          ['patterns', 'Use chart patterns as well as colour'],
        ] as const
      ).map(([key, label]) => (
        <label className="check-label" key={key}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </>
  );
}
