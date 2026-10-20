import { useMemo, useState } from 'react';
import { TrendingUp, Trophy, Layers, Dumbbell, ArrowUpRight, Calculator } from 'lucide-react';
import { useApp } from '../lib/context';
import {
  estimatedMax,
  exerciseHistory,
  fromKg,
  toKg,
  fmt,
  dateLabel,
  dateKey,
  personalRecords,
  compare,
  roundTo,
  recommendation,
} from '../lib/calc';
import {
  Card,
  PageTitle,
  SectionTitle,
  Metric,
  Empty,
  Field,
  Delta,
  Badge,
} from '../components/ui';
import { trackingLabel } from './Exercises';
import { type Exercise } from '../lib/model';
import { TrendChart } from '../components/Chart';
import { AddToPage } from '../components/WorkspaceControls';
import { FoodTrainingContext } from '../components/FoodOverview';
export function Progress() {
  const { data } = useApp();
  const query = new URLSearchParams(location.hash.split('?')[1]);
  const [id, setId] = useState(query.get('exercise') || data.exercises[0]?.id || '');
  const [days, setDays] = useState(Number(query.get('days') ?? 90));
  const [metric, setMetric] = useState(query.get('metric') || 'volume');
  const [historyTracking, setHistoryTracking] = useState(query.get('tracking') || '');
  const [repMin, setRepMin] = useState(query.get('repMin') || '');
  const [repMax, setRepMax] = useState(query.get('repMax') || '');
  const [loadMin, setLoadMin] = useState(
    query.has('loadMinKg')
      ? String(fromKg(Number(query.get('loadMinKg')), data.settings.unit))
      : '',
  );
  const [loadMax, setLoadMax] = useState(
    query.has('loadMaxKg')
      ? String(fromKg(Number(query.get('loadMaxKg')), data.settings.unit))
      : '',
  );
  const [includeWarmup, setIncludeWarmup] = useState(query.get('warmup') === '1');
  const [since, setSince] = useState(query.get('from') || '');
  const [until, setUntil] = useState(query.get('to') || '');
  const [setupId, setSetupId] = useState(query.get('setup') || '');
  const [basis, setBasis] = useState(query.get('basis') || '');
  const exercise = data.exercises.find((e) => e.id === id);
  const expected = historyTracking || exercise?.tracking;
  const historicalTypes = [
    ...new Set(
      [
        exercise?.tracking,
        ...data.sessions.flatMap((s) =>
          s.items.filter((i) => i.exerciseId === id).map((i) => i.tracking),
        ),
      ].filter(Boolean),
    ),
  ] as string[];
  const [calculatorLoad, setCalculatorLoad] = useState('');
  const [calculatorReps, setCalculatorReps] = useState('5');
  const [percentage, setPercentage] = useState('80');
  const filteredData = useMemo(
    () => ({
      ...data,
      exercises: data.exercises.map((e) =>
        e.id === id ? { ...e, tracking: expected as Exercise['tracking'] } : e,
      ),
      sets: data.sets
        .filter(
          (s) =>
            s.exerciseId === id &&
            (!setupId || s.setup?.id === setupId) &&
            (!basis || (s.setup?.basis ?? 'unspecified') === basis) &&
            s.completed &&
            (includeWarmup || s.label !== 'warmup') &&
            (!repMin || (s.reps || 0) >= +repMin) &&
            (!repMax || (s.reps || 0) <= +repMax) &&
            (!loadMin || fromKg(s.loadKg || 0, data.settings.unit) >= +loadMin) &&
            (!loadMax || fromKg(s.loadKg || 0, data.settings.unit) <= +loadMax),
        )
        .map((s) =>
          includeWarmup && s.label === 'warmup' ? { ...s, label: 'working' as const } : s,
        ),
    }),
    [data, id, repMin, repMax, loadMin, loadMax, includeWarmup, expected, setupId, basis],
  );
  const history = useMemo(
    () =>
      exerciseHistory(filteredData, id).filter(
        (h) =>
          (!days || Date.parse(h.session.startAt) >= Date.now() - days * 86400000) &&
          (!since || h.session.startAt >= new Date(since + 'T00:00:00').toISOString()) &&
          (!until || h.session.startAt < new Date(until + 'T23:59:59.999').toISOString()),
      ),
    [filteredData, id, days, since, until],
  );
  const latest = history[0];
  const previous = history[1];
  const comparisons = latest && previous ? compare(latest, previous) : null;
  const records = useMemo(
    () =>
      personalRecords(filteredData).filter(
        (r) => r.exerciseId === id && history.some((h) => h.session.id === r.sessionId),
      ),
    [filteredData, id, history],
  );
  const bestMax = Math.max(0, ...history.map((h) => h.bestMax));
  const max = calculatorLoad
    ? estimatedMax(
        toKg(+calculatorLoad, data.settings.unit),
        +calculatorReps,
        data.settings.formula,
      )
    : bestMax || undefined;
  const recommendationValue = exercise ? recommendation(data, exercise) : null;
  const weighted = expected === 'weighted';
  const unit =
    metric === 'volume' || metric === 'bestLoad' || metric === 'bestMax'
      ? data.settings.unit
      : metric === 'reps'
        ? 'reps'
        : metric === 'sets'
          ? 'sets'
          : metric === 'duration'
            ? 'seconds'
            : 'metres';
  const incompatible =
    ['volume', 'bestLoad', 'bestMax'].includes(metric) &&
    new Set(
      history.flatMap((h) =>
        h.sets.map((s) => (s.setup?.id ?? 'legacy') + ':' + (s.setup?.basis ?? 'unspecified')),
      ),
    ).size > 1;
  const chart = [...(incompatible ? [] : history)].reverse().map((h) => ({
    date: dateLabel(h.session.startAt),
    day: dateKey(h.session.startAt),
    value:
      metric === 'sets'
        ? h.sets.length
        : metric === 'duration'
          ? h.sets.reduce((n, s) => n + (s.durationSeconds || 0), 0)
          : metric === 'distance'
            ? h.sets.reduce((n, s) => n + (s.distanceM || 0), 0)
            : metric === 'reps'
              ? h.reps
              : fromKg(h[metric as 'volume' | 'bestLoad' | 'bestMax'], data.settings.unit),
  }));
  return (
    <>
      <PageTitle
        eyebrow="PROGRESS YOU CAN SEE"
        title="One session at a time."
        description="Look back with context. Look ahead with a plan."
        action={
          <AddToPage
            type="exercise"
            config={{
              exerciseId: id,
              tracking: expected as Exercise['tracking'],
              metric: metric as import('../lib/workspace-model').WidgetConfig['metric'],
              includeWarmup,
              repMin: repMin ? +repMin : undefined,
              repMax: repMax ? +repMax : undefined,
              loadMinKg: loadMin ? toKg(+loadMin, data.settings.unit) : undefined,
              loadMaxKg: loadMax ? toKg(+loadMax, data.settings.unit) : undefined,
              setupId: setupId || undefined,
              basis: (basis || undefined) as import('../lib/workspace-model').WidgetConfig['basis'],
              range: { days, from: since || undefined, to: until || undefined },
            }}
          />
        }
      />
      {incompatible && (
        <p className="callout">
          These readings use different setups or load conventions. Choose an equipment context
          before comparing loads.
        </p>
      )}
      <Card className="filter-card">
        <Field label="Equipment context">
          <select value={setupId} onChange={(e) => setSetupId(e.target.value)}>
            <option value="">All setups</option>
            {data.workspace?.setups
              .filter((s) => s.exerciseId === id)
              .map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name} {s.gym}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Recorded load convention">
          <select value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="">All conventions</option>
            {['unspecified', 'total', 'per_dumbbell', 'per_side'].map((b) => (
              <option key={b} value={b}>
                {b.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Exercise">
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setHistoryTracking('');
              setCalculatorLoad('');
            }}
          >
            {data.exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Comparable tracking type">
          <select
            value={expected || 'weighted'}
            onChange={(e) => setHistoryTracking(e.target.value)}
          >
            {historicalTypes.map((type) => (
              <option key={type} value={type}>
                {trackingLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date range">
          <select value={days} onChange={(e) => setDays(+e.target.value)}>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
            <option value={0}>All time / custom</option>
          </select>
        </Field>
        <Field label="Chart metric">
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="volume">External volume</option>
            <option value="bestLoad">Highest external load</option>
            <option value="reps">Total repetitions</option>
            <option value="sets">Working sets</option>
            {weighted && <option value="bestMax">Estimated 1RM</option>}
            <option value="duration">Duration</option>
            <option value="distance">Distance</option>
          </select>
        </Field>
      </Card>
      <div className="metric-grid">
        <Metric
          label="Recorded sessions"
          value={history.length}
          icon={<Dumbbell size={18} />}
          foot="Matching your current filters"
        />
        <Metric
          label="Best load"
          value={
            history.length && !incompatible
              ? fmt(fromKg(Math.max(...history.map((h) => h.bestLoad)), data.settings.unit))
              : '—'
          }
          unit={data.settings.unit}
          icon={<TrendingUp size={18} />}
          foot="External or assistance load; inspect sets"
        />
        <Metric
          label="Estimated 1RM"
          value={!incompatible && bestMax ? fmt(fromKg(bestMax, data.settings.unit)) : '—'}
          unit={data.settings.unit}
          icon={<Trophy size={18} />}
          foot={`${data.settings.formula === 'epley' ? 'Epley' : 'Brzycki'} · weighted sets of 1–12 reps`}
        />
        <Metric
          label="Completed sets"
          value={history.reduce((n, h) => n + h.sets.length, 0)}
          icon={<Layers size={18} />}
          foot={includeWarmup ? 'Includes warm-up sets' : 'Warm-ups excluded'}
        />
      </div>
      <div className="two-col progress-layout">
        <Card>
          <SectionTitle
            title={exercise?.name || 'Exercise progression'}
            sub={`${history.length} comparable sessions · ${unit}`}
            action={<Badge>{data.settings.formula.toUpperCase()}</Badge>}
          />
          <TrendChart
            label={
              {
                volume: 'External volume',
                bestLoad: 'Highest load',
                bestMax: 'Estimated 1RM',
                reps: 'Repetitions',
                sets: 'Working sets',
                duration: 'Duration',
                distance: 'Distance',
              }[metric] || 'Progress'
            }
            unit={unit}
            data={chart}
          />
          {comparisons && (
            <div className="comparison-row">
              <span>Latest vs previous</span>
              <span>
                Load{' '}
                <Delta
                  value={fromKg(comparisons.load, data.settings.unit)}
                  unit={` ${data.settings.unit}`}
                />
              </span>
              <span>
                Reps <Delta value={comparisons.reps} />
              </span>
              <span>
                Volume <Delta value={comparisons.volumePercent || 0} unit="%" />
              </span>
              <span>
                Sets <Delta value={comparisons.sets} />
              </span>
              {weighted && (
                <span>
                  Estimated max{' '}
                  <Delta
                    value={fromKg(comparisons.max, data.settings.unit)}
                    unit={` ${data.settings.unit}`}
                  />
                </span>
              )}
            </div>
          )}
        </Card>
        <Card className="recommendation-card">
          <span className="eyebrow">A SUGGESTION, WITH CONTEXT</span>
          <h2>
            {recommendationValue?.increase ? 'Room to build.' : 'Keep building your baseline.'}
          </h2>
          {recommendationValue && (
            <>
              <div className="suggested-target">
                {recommendationValue.loadKg > 0 && (
                  <strong>
                    {fmt(fromKg(recommendationValue.loadKg, data.settings.unit))}
                    <small>{data.settings.unit}</small>
                  </strong>
                )}
                <span>
                  {recommendationValue.sets} sets × {recommendationValue.reps} reps
                  <br />
                  {recommendationValue.rest}s rest
                </span>
              </div>
              <p>{recommendationValue.reason}</p>
            </>
          )}
          <small>
            Review and edit any suggestion before training. Suggestions never change your saved
            plans. Log RPE or RIR to give effort more context.
          </small>
        </Card>
      </div>
      <Card>
        <details className="analytics-filters">
          <summary>Inspect and filter the contributing sets</summary>
          <div className="form-grid three">
            <Field label="Reps from">
              <input
                type="number"
                min={0}
                value={repMin}
                onChange={(e) => setRepMin(e.target.value)}
              />
            </Field>
            <Field label="Reps to">
              <input
                type="number"
                min={0}
                value={repMax}
                onChange={(e) => setRepMax(e.target.value)}
              />
            </Field>
            <Field label={`Load from (${data.settings.unit})`}>
              <input
                type="number"
                min={0}
                step="any"
                value={loadMin}
                onChange={(e) => setLoadMin(e.target.value)}
              />
            </Field>
            <Field label={`Load to (${data.settings.unit})`}>
              <input
                type="number"
                min={0}
                step="any"
                value={loadMax}
                onChange={(e) => setLoadMax(e.target.value)}
              />
            </Field>
            <Field label="From date">
              <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
            </Field>
            <Field label="To date">
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </Field>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={includeWarmup}
              onChange={(e) => setIncludeWarmup(e.target.checked)}
            />
            Include warm-ups in this analysis
          </label>
        </details>
        <SectionTitle
          title="Session-by-session history"
          sub="Every contributing set, exactly as logged."
        />
        {!history.length ? (
          <Empty title="No matching training yet" compact>
            Log this exercise, or adjust your filters to find earlier sessions.
          </Empty>
        ) : (
          history.map((h) => (
            <details className="history-detail" key={h.session.id}>
              <summary>
                <span>
                  <strong>
                    {dateLabel(h.session.startAt, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                  <small>{h.session.name}</small>
                </span>
                <span>
                  {h.sets.length} sets · {h.reps} reps ·{' '}
                  {fmt(fromKg(h.volume, data.settings.unit), 0)} {data.settings.unit}
                  <ArrowUpRight size={15} />
                </span>
              </summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Set</th>
                      <th>Load / assist ({data.settings.unit})</th>
                      <th>Reps</th>
                      <th>Time / distance</th>
                      <th>Effort</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h.sets.map((s, n) => (
                      <tr key={s.id}>
                        <td>{n + 1}</td>
                        <td>
                          {s.loadKg === undefined ? '—' : fmt(fromKg(s.loadKg, data.settings.unit))}
                        </td>
                        <td>{s.reps ?? '—'}</td>
                        <td>
                          {s.durationSeconds ? `${s.durationSeconds}s` : ''}{' '}
                          {s.distanceM ? `${s.distanceM}m` : ''}
                        </td>
                        <td>
                          {s.rpe !== undefined
                            ? `RPE ${s.rpe}`
                            : s.rir !== undefined
                              ? `${s.rir} RIR`
                              : '—'}
                        </td>
                        <td>{data.sets.find((x) => x.id === s.id)?.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <a className="text-link" href={`#/history?session=${h.session.id}`}>
                View or edit workout <ArrowUpRight size={14} />
              </a>
            </details>
          ))
        )}
      </Card>
      <FoodTrainingContext />
      <div className="two-col">
        <Card>
          <SectionTitle
            title="Estimated one-rep max"
            sub={`${data.settings.formula === 'epley' ? 'Epley: load × (1 + reps / 30)' : 'Brzycki: load × 36 / (37 − reps)'} · external-load lifts only`}
          />
          <div className="form-grid">
            <Field label={`Lifted load (${data.settings.unit})`}>
              <input
                type="number"
                min={0}
                step="any"
                placeholder={bestMax ? 'Use best recorded estimate' : 'Enter a load'}
                value={calculatorLoad}
                onChange={(e) => setCalculatorLoad(e.target.value)}
              />
            </Field>
            <Field label="Repetitions (1–12)">
              <input
                type="number"
                min={1}
                max={12}
                step="any"
                value={calculatorReps}
                onChange={(e) => setCalculatorReps(e.target.value)}
              />
            </Field>
          </div>
          <div className="max-result">
            {max ? fmt(fromKg(max, data.settings.unit)) : '—'}{' '}
            <small>{data.settings.unit} estimated</small>
          </div>
          <div className="percentage-table">
            {[50, 60, 65, 70, 75, 80, 85, 90, 95, 100].map((p) => (
              <div key={p}>
                <span>{p}%</span>
                <strong>
                  {max
                    ? fmt(
                        roundTo(
                          fromKg((max * p) / 100, data.settings.unit),
                          data.settings.weightIncrement,
                        ),
                      )
                    : '—'}
                </strong>
              </div>
            ))}
          </div>
          <div className="inline-form">
            <Field label="Custom percentage">
              <input
                type="number"
                min={1}
                max={100}
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
              />
            </Field>
            <strong>
              {max && +percentage > 0 && +percentage <= 100
                ? fmt(
                    roundTo(
                      fromKg((max * +percentage) / 100, data.settings.unit),
                      data.settings.weightIncrement,
                    ),
                  )
                : '—'}{' '}
              {data.settings.unit}
            </strong>
          </div>
          <p className="small-text muted">
            An estimate, not a tested maximum. Estimates are withheld above 12 reps. Loads round to
            your configured {data.settings.weightIncrement} {data.settings.unit} increment.
          </p>
        </Card>
        <Card>
          <SectionTitle title="Exercise records" sub="Calculated from saved, completed sets." />
          {records.length ? (
            <div className="record-table">
              {records.map((r) => (
                <a href={`#/history?session=${r.sessionId}`} key={r.kind + r.contextKey}>
                  <span>
                    <strong>{r.kind}</strong>
                    <small>{dateLabel(r.at)}</small>
                  </span>
                  <b>
                    {fmt(r.unit === 'kg' ? fromKg(r.value, data.settings.unit) : r.value)}{' '}
                    <small>{r.unit === 'kg' ? data.settings.unit : r.unit}</small>
                  </b>
                </a>
              ))}
            </div>
          ) : (
            <Empty title="Set your benchmark" compact>
              Your first completed session establishes your records.
            </Empty>
          )}
        </Card>
      </div>
    </>
  );
}
export function Records() {
  const { data } = useApp();
  const [exercise, setExercise] = useState('');
  const [kind, setKind] = useState('');
  const records = useMemo(() => personalRecords(data), [data]);
  const filtered = records
    .filter((r) => (!exercise || r.exerciseId === exercise) && (!kind || r.kind === kind))
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <>
      <PageTitle
        eyebrow="YOUR PERSONAL BEST"
        title="Proof of progress."
        description="Real records. Real sessions. Every benchmark earned."
      />
      <Card className="filter-card">
        <select
          aria-label="Record exercise"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
        >
          <option value="">All exercises</option>
          {data.exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select aria-label="Record category" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All record categories</option>
          {[...new Set(records.map((r) => r.kind))].sort().map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </Card>
      <div className="record-grid">
        {filtered.map((r) => (
          <Card key={r.exerciseId + r.kind + r.contextKey} className="personal-record">
            <span className="record-medal">
              <Trophy size={22} />
            </span>
            <span className="eyebrow">{r.kind}</span>
            <h3>{r.exercise}</h3>
            {r.context && <p className="muted">{r.context}</p>}
            <div className="record-value">
              {fmt(r.unit === 'kg' ? fromKg(r.value, data.settings.unit) : r.value)}{' '}
              <small>{r.unit === 'kg' ? data.settings.unit : r.unit}</small>
            </div>
            <a className="text-link" href={`#/history?session=${r.sessionId}`}>
              {dateLabel(r.at, { day: 'numeric', month: 'long', year: 'numeric' })}
              <ArrowUpRight size={15} />
            </a>
          </Card>
        ))}
      </div>
      {!filtered.length && (
        <Card>
          <Empty title="Your benchmarks belong here">
            Complete working sets to establish records. Warm-ups are excluded, and records
            recalculate after edits or deletions.
          </Empty>
        </Card>
      )}
    </>
  );
}
