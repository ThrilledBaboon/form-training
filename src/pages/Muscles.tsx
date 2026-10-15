import { useMemo, useState } from 'react';
import { ArrowUpRight, Info, Activity, Layers } from 'lucide-react';
import { useApp } from '../lib/context';
import { muscleContributions, fmt, heatColor, dateLabel, fromKg, dateKey } from '../lib/calc';
import { MUSCLES, muscleName, type Muscle } from '../lib/model';
import { Card, PageTitle, SectionTitle, Badge, Empty, Field, Delta } from '../components/ui';
import { Anatomy } from '../components/Anatomy';
import { TrendChart } from '../components/Chart';
export function Muscles() {
  const { data } = useApp();
  const q = new URLSearchParams(location.hash.split('?')[1]);
  const initial = q.get('muscle');
  const [selected, setSelected] = useState<Muscle>(
    MUSCLES.includes(initial as Muscle) ? (initial as Muscle) : 'chest',
  );
  const [days, setDays] = useState(7);
  const [mode, setMode] = useState('sets');
  const [relative, setRelative] = useState(false);
  const [since, setSince] = useState('');
  const [until, setUntil] = useState(dateKey(new Date()));
  const at =
    until && until !== dateKey(new Date())
      ? new Date(until + 'T23:59:59.999').getTime()
      : Date.now();
  const period = since
    ? Math.max(0.01, (at - new Date(since + 'T00:00:00').getTime()) / 86400000)
    : days;
  const muscles = useMemo(() => muscleContributions(data, period, at), [data, period, at]);
  const values = Object.fromEntries(
    muscles.map((m) => [
      m.muscle,
      mode === 'recovery' ? m.recentLoad : mode === 'score' ? m.score : m.sets,
    ]),
  );
  const max = relative ? Math.max(1, ...Object.values(values)) : data.settings.muscleScale;
  const current = muscles.find((m) => m.muscle === selected)!;
  const previous = useMemo(
    () =>
      period > 0
        ? muscleContributions(data, period, at - period * 86400000 - 1).find(
            (m) => m.muscle === selected,
          )
        : undefined,
    [data, period, at, selected],
  );
  const trend = useMemo(() => {
    const daily = new Map<string, number>();
    for (const entry of current.details) {
      const day = dateKey(entry.session.startAt);
      daily.set(day, (daily.get(day) || 0) + (mode === 'sets' ? entry.contribution : entry.score));
    }
    return [...daily]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, value]) => ({
        date: dateLabel(day + 'T12:00:00'),
        value,
      }));
  }, [current, mode]);
  return (
    <>
      <PageTitle
        eyebrow="SEE THE WORK BEHIND THE WORK"
        title="Every muscle has a story."
        description="Understand your training balance, one region at a time."
      />
      <Card className="filter-card">
        <Field label="Training period">
          <select
            value={days}
            onChange={(e) => {
              setDays(+e.target.value);
              setSince('');
            }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={0}>All time / custom</option>
          </select>
        </Field>
        <Field label="View">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="sets">Set contributions</option>
            <option value="score">Relative volume score</option>
            <option value="recovery">Recent training / recovery estimate</option>
          </select>
        </Field>
        <Field label="Scale">
          <select value={String(relative)} onChange={(e) => setRelative(e.target.value === 'true')}>
            <option value="false">Fixed scale: {data.settings.muscleScale}</option>
            <option value="true">Relative to busiest muscle</option>
          </select>
        </Field>
        <Field label="From (optional)">
          <input type="date" value={since} max={until} onChange={(e) => setSince(e.target.value)} />
        </Field>
        <Field label="Through date">
          <input type="date" value={until} min={since} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      </Card>
      {mode === 'recovery' && (
        <div className="info-banner">
          <Info size={20} />
          <p>
            <strong>A rough planning estimate.</strong> Recent contributions fade by half every{' '}
            {data.settings.recoveryHours} hours. This does not measure recovery, fatigue, readiness
            or muscle growth. Use how you feel and the context of your training.
          </p>
        </div>
      )}
      <div className="muscle-page-grid">
        <Card className="anatomy-card">
          <SectionTitle
            title={
              mode === 'recovery'
                ? 'Recent training load'
                : mode === 'score'
                  ? 'Relative volume contribution'
                  : 'Training contribution'
            }
            sub="Original anatomical illustration · tap a region"
            action={<Badge>{since ? 'CUSTOM' : days ? `${days} DAYS` : 'ALL TIME'}</Badge>}
          />
          <Anatomy values={values} max={max} selected={selected} onSelect={setSelected} />
          <div className="heat-legend">
            <span>No contribution</span>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <span>Higher contribution</span>
          </div>
          <p className="small-text muted">
            {relative
              ? 'Colours are relative to the largest contribution in this period.'
              : `Fixed scale: dark green begins above ${fmt(max * 0.8)} contributions.`}{' '}
            Grey means no recorded contribution.{' '}
            {mode === 'recovery'
              ? 'Green here means more recent training, not more recovery.'
              : 'Each muscle is calculated independently.'}
          </p>
        </Card>
        <Card className="muscle-detail-card">
          <span className="eyebrow">SELECTED REGION</span>
          <h2>{muscleName(selected)}</h2>
          <div className="muscle-detail-total">
            <strong>{fmt(values[selected])}</strong>
            <span>
              {mode === 'recovery'
                ? 'recent load estimate'
                : mode === 'score'
                  ? 'relative volume points'
                  : 'weighted set contributions'}
            </span>
          </div>
          <div className="muscle-split">
            <div>
              <small>PRIMARY</small>
              <strong>{fmt(current.primary)}</strong>
            </div>
            <div>
              <small>SECONDARY</small>
              <strong>{fmt(current.secondary)}</strong>
            </div>
            <div>
              <small>SESSIONS</small>
              <strong>{new Set(current.details.map((d) => d.session.id)).size}</strong>
            </div>
          </div>
          <h3>Where it came from</h3>
          {current.details.length ? (
            <div className="contribution-details">
              {current.details.map((d) => (
                <a key={d.set.id} href={`#/history?session=${d.session.id}`}>
                  <span>
                    <strong>{d.exercise}</strong>
                    <small>
                      {dateLabel(d.session.startAt)} · {d.role} ·{' '}
                      {d.set.loadKg
                        ? `${fmt(fromKg(d.set.loadKg, data.settings.unit))} ${data.settings.unit} × `
                        : ''}
                      {d.set.reps
                        ? `${d.set.reps} reps`
                        : d.set.durationSeconds
                          ? `${d.set.durationSeconds}s`
                          : ''}
                      {d.set.distanceM ? ` · ${d.set.distanceM}m` : ''}
                    </small>
                  </span>
                  <b>
                    {fmt(mode === 'score' ? d.score : d.contribution)} <ArrowUpRight size={13} />
                  </b>
                </a>
              ))}
            </div>
          ) : (
            <Empty title="A fresh start for this region" compact>
              No completed working sets contributed in this period.
            </Empty>
          )}
        </Card>
      </div>
      <div className="two-col">
        <Card>
          <SectionTitle
            title={`${muscleName(selected)} over time`}
            sub="Daily totals on recorded training days. Empty days have no invented points."
          />
          <TrendChart
            data={trend}
            unit={mode === 'sets' ? 'contributions' : 'relative points'}
            label={mode === 'sets' ? 'Muscle set contributions' : 'Muscle relative volume'}
          />
          {mode === 'recovery' && (
            <p className="small-text muted">
              This chart shows recorded relative volume, before recovery decay. The recent-load
              estimate is shown separately above.
            </p>
          )}
        </Card>
        <Card>
          <SectionTitle
            title="Compare training periods"
            sub={
              previous
                ? `Selected period vs the preceding ${fmt(period)} days of equal length.`
                : 'Choose a 7, 30, 90-day or custom period to compare.'
            }
          />
          {previous ? (
            <>
              <div className="comparison-row">
                <span>Set contributions</span>
                <strong>
                  {fmt(current.sets)} vs {fmt(previous.sets)}
                </strong>
                <Delta value={current.sets - previous.sets} />
              </div>
              <div className="comparison-row">
                <span>Relative volume points</span>
                <strong>
                  {fmt(current.score)} vs {fmt(previous.score)}
                </strong>
                <Delta value={current.score - previous.score} />
              </div>
              <p className="small-text muted">
                {previous.sets > 0
                  ? `${fmt((current.sets / previous.sets - 1) * 100)}% change in set contributions. Both periods use the same current muscle mappings and exercise baselines.`
                  : 'No contribution was recorded in the preceding period. More history will make this comparison useful.'}
              </p>
              <p className="small-text muted">
                Training frequency:{' '}
                {new Set(current.details.map((d) => dateKey(d.session.startAt))).size} training days
                vs {new Set(previous.details.map((d) => dateKey(d.session.startAt))).size}{' '}
                previously. These totals do not measure recovery or growth.
              </p>
            </>
          ) : (
            <Empty title="Choose a comparison window" compact>
              All-time totals have no preceding equal-length period.
            </Empty>
          )}
        </Card>
      </div>
      <Card>
        <SectionTitle
          title="The complete picture"
          sub="An accessible alternative to the colour map. Select any muscle to inspect its sets."
        />
        <div className="muscle-list-grid">
          {[...muscles]
            .sort((a, b) => b.sets - a.sets)
            .map((m) => (
              <button
                key={m.muscle}
                className={selected === m.muscle ? 'selected' : ''}
                onClick={() => {
                  setSelected(m.muscle);
                  document.querySelector('.muscle-detail-card')?.scrollIntoView({
                    behavior: data.settings.reducedMotion ? 'instant' : 'smooth',
                    block: 'nearest',
                  });
                }}
              >
                <i style={{ background: heatColor(values[m.muscle], max) }} />
                <span>{muscleName(m.muscle)}</span>
                <strong>{fmt(values[m.muscle])}</strong>
              </button>
            ))}
        </div>
      </Card>
      <Card>
        <details>
          <summary>How these estimates are calculated</summary>
          <div className="method-copy">
            <p>
              <strong>Set contributions:</strong> each completed working set contributes its
              exercise mapping × {data.settings.primaryFactor} for a primary muscle, or ×{' '}
              {data.settings.secondaryFactor} for a secondary muscle. Warm-ups are excluded. A set
              appears once per muscle; contributions across different muscles should not be added
              into a unique set count.
            </p>
            <p>
              <strong>Relative volume score:</strong> a set’s logged magnitude is divided by the
              median nonzero set magnitude for that exercise, then limited to 0.25–3 and multiplied
              by its muscle contribution. Weighted exercises use external load × reps; duration uses
              seconds; distance uses metres. Bodyweight/assisted exercises use reps unless you
              explicitly enable saved bodyweight calculations. This dimensionless score helps
              compare work relative to your own exercise history. It is not a measure of activation,
              stimulus or hypertrophy.
            </p>
            <p>
              <strong>Recent training estimate:</strong> relative volume points × 0.5^(hours since
              training / {data.settings.recoveryHours}). This is a configurable planning heuristic,
              separate from volume accounting. There is no claim that a muscle is fully recovered at
              a particular time.
            </p>
            <a href="#/settings" className="text-link">
              Configure assumptions <ArrowUpRight size={15} />
            </a>
          </div>
        </details>
      </Card>
    </>
  );
}
