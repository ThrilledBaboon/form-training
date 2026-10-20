import { useState } from 'react';
import { useApp } from '../lib/context';
import {
  typicalStreak,
  practiceData,
  comparisonKey,
  resultValue,
  type PracticeData,
  type PracticeSystem,
} from '../lib/practice-model';
import { type ViewRange, type Widget } from '../lib/workspace-model';
import { rangeBounds } from '../lib/widget-registry';
import { dateKey } from '../lib/calc';
import { weekDays, foodDay } from '../lib/food-calc';
import { Field } from './ui';
import { TrendChart } from './Chart';
import { PracticeStart } from '../pages/Practice';
import { ActivityStreak } from './WorkoutStreak';
export function PracticeWidget({ widget, range }: { widget: Widget; range: ViewRange }) {
  const { data } = useApp();
  const system: PracticeSystem = widget.type.startsWith('football-') ? 'football' : 'rocket-league';
  const p = practiceData(data, system);
  const bounds = rangeBounds(widget.config.range ?? range);
  const filtered = {
    ...p,
    sessions: p.sessions.filter(
      (s) => Date.parse(s.startAt) >= bounds.start && Date.parse(s.startAt) <= bounds.end,
    ),
  };
  if (widget.type.endsWith('-start')) return <PracticeStart p={p} />;
  if (widget.type.endsWith('-streak')) return <ActivityStreak system={system} />;
  if (widget.type.endsWith('-week'))
    return (
      <>
        <PracticeWeek p={p} />
        <p>Focus: {p.focus || 'Choose your current focus in Practice goals.'}</p>
        <a href={'#/' + system + '-library'}>Edit practice goals</a>
      </>
    );
  if (widget.type.endsWith('-skills')) return <PracticeBalance p={filtered} />;
  return <PracticeProgress p={filtered} />;
}
export function PracticeWeek({ p }: { p: PracticeData }) {
  const days = weekDays(foodDay());
  const sessions = p.sessions.filter(
    (s) => s.status === 'completed' && days.includes(dateKey(s.startAt)),
  );
  return (
    <>
      <div className="practice-metrics">
        <div>
          <strong>
            {sessions.length} / {p.goal}
          </strong>
          <span>sessions this week</span>
        </div>
        <div>
          <strong>
            {Math.round(
              sessions.reduce(
                (n, s) =>
                  n +
                  s.entries
                    .filter((e) => e.status === 'completed')
                    .reduce((n, e) => n + e.elapsedSeconds, 0),
                0,
              ) / 60,
            )}
          </strong>
          <span>recorded practice minutes</span>
        </div>
      </div>
      <progress
        aria-label="Weekly practice goal"
        max={p.goal}
        value={Math.min(p.goal, sessions.length)}
      />
    </>
  );
}
export function PracticeBalance({ p }: { p: PracticeData }) {
  const categories = new Map<string, number>();
  for (const s of p.sessions.filter((s) => s.status === 'completed'))
    for (const e of s.entries.filter((e) => e.status === 'completed'))
      categories.set(e.drill.category, (categories.get(e.drill.category) ?? 0) + e.elapsedSeconds);
  const rows = [...categories].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, [, v]) => n + v, 0);
  if (!total) return <p>No recorded practice time in this view yet.</p>;
  const colours = ['#438267', '#8266bd', '#4b88b0', '#b97735', '#ae5e7f', '#667b39'];
  let offset = 0;
  return (
    <>
      <svg
        className="practice-wheel"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Recorded practice time by category"
      >
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--line)" strokeWidth="15" />
        {rows.map(([name, value], i) => {
          const length = (value / total) * 100;
          const start = offset;
          offset += length;
          return (
            <circle
              key={name}
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke={colours[i % colours.length]}
              strokeWidth="15"
              pathLength="100"
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-start}
              transform="rotate(-90 50 50)"
            >
              <title>
                {name}: {(value / 60).toFixed(1)} minutes
              </title>
            </circle>
          );
        })}
        <text x="50" y="53" textAnchor="middle" fill="var(--ink)" fontSize="12">
          {Math.round(total / 60)} min
        </text>
      </svg>
      <ul>
        {rows.map(([name, value]) => (
          <li key={name}>
            {name}: {(value / 60).toFixed(1)} min · {Math.round((value / total) * 100)}%
          </li>
        ))}
      </ul>
      <p className="small-text muted">
        Time spent practising, rather than an ability rating. Paused and skipped time is excluded.
      </p>
    </>
  );
}
export function PracticeProgress({ p }: { p: PracticeData }) {
  const [selection, setSelection] = useState('');
  const entries = p.sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .flatMap((s) => s.entries.map((e) => ({ e, date: dateKey(s.startAt), sessionId: s.id })));
  const series = new Map(
    entries
      .filter(({ e }) => resultValue(e) !== undefined)
      .map(({ e }) => [comparisonKey(e.drill), e.drill]),
  );
  const selected = series.has(selection) ? selection : [...series.keys()][0];
  const drill = series.get(selected);
  if (!drill) return <p>Record a drill result to see comparable progress and personal bests.</p>;
  const points = entries
    .filter(({ e }) => comparisonKey(e.drill) === selected && resultValue(e) !== undefined)
    .map(({ e, date }) => ({ date, value: Number(resultValue(e)!.toFixed(2)) }));
  const best =
    drill.metric === 'course'
      ? Math.min(...points.map((p) => p.value))
      : Math.max(...points.map((p) => p.value));
  const unit =
    drill.metric === 'accuracy'
      ? '%'
      : drill.metric === 'course'
        ? 'sec'
        : drill.metric === 'streak'
          ? 'consecutive'
          : 'min';
  const selectedEntries = entries.filter(({ e }) => comparisonKey(e.drill) === selected);
  const latestSession = selectedEntries.at(-1)?.sessionId;
  const streak = typicalStreak(
    selectedEntries.filter((e) => e.sessionId === latestSession).map(({ e }) => e),
  );
  const sameCourse = (d: typeof drill) =>
    comparisonKey({ ...d, foot: 'both' }) === comparisonKey({ ...drill, foot: 'both' });
  const footRows = (['left', 'right'] as const).map((foot) => {
    const rows = entries
      .filter(
        ({ e }) => e.drill.foot === foot && sameCourse(e.drill) && resultValue(e) !== undefined,
      )
      .map(({ e }) => e);
    const values = rows.map((e) => resultValue(e)!);
    const attempts = rows.reduce((n, e) => n + (e.result?.attempts ?? 0), 0);
    const value = !rows.length
      ? undefined
      : drill.metric === 'accuracy'
        ? (rows.reduce((n, e) => n + (e.result?.hits ?? 0), 0) / attempts) * 100
        : drill.metric === 'course'
          ? Math.min(...values)
          : Math.max(...values);
    return { foot, value, sets: rows.length };
  });
  // A course PB must use the same course and foot; no averaging or comparing different setups.
  return (
    <>
      <Field label="Drill & setup">
        <select value={selected} onChange={(e) => setSelection(e.target.value)}>
          {[...series].map(([key, d]) => (
            <option key={key} value={key}>
              {d.name} · {d.foot} · {d.setup || 'Original setup'}
              {d.cones.length ? ' · ' + d.cones.length + ' cones' : ''}
            </option>
          ))}
        </select>
      </Field>
      <p>
        {drill.metric === 'time' ? 'Longest recorded set:' : 'Personal best:'}{' '}
        <strong>
          {best.toFixed(drill.metric === 'course' ? 2 : 1)} {unit}
        </strong>
      </p>
      {streak && (
        <p>
          Latest session: best {streak.best} · typical streak {streak.median} (median of{' '}
          {streak.attempts} recorded tries).
        </p>
      )}
      {p.id === 'football' && footRows.some((r) => r.sets) && (
        <div className="practice-metrics">
          {footRows.map((r) => (
            <p key={r.foot}>
              {r.foot}:{' '}
              <strong>
                {r.value === undefined ? 'Unrecorded' : r.value.toFixed(1) + ' ' + unit}
              </strong>
              <small>
                {r.sets} sets · {drill.metric === 'accuracy' ? 'combined accuracy' : 'best result'}
              </small>
            </p>
          ))}
        </div>
      )}
      <TrendChart data={points} unit={unit} label={drill.name} />
      <p className="small-text muted">
        Each point is a recorded set with the same drill, setup and foot.{' '}
        {drill.metric === 'course'
          ? 'Lower course times are better.'
          : 'Results with missing counts stay unrecorded.'}
      </p>
    </>
  );
}
