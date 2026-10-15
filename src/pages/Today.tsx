import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Plus,
  Play,
  Dumbbell,
  Layers,
  Clock3,
  TrendingUp,
  CalendarDays,
  ShieldCheck,
  ChevronRight,
  Weight,
  Check,
} from 'lucide-react';
import { useApp, go } from '../lib/context';
import { startSession } from '../lib/actions';
import {
  completedSessions,
  sessionStats,
  fromKg,
  fmt,
  dateLabel,
  dateKey,
  dayStats,
  muscleContributions,
  personalRecords,
  bodyweightTrend,
  exerciseHistory,
} from '../lib/calc';
import {
  Card,
  PageTitle,
  SectionTitle,
  Metric,
  Button,
  AsyncButton,
  Empty,
  LinkButton,
  Badge,
} from '../components/ui';
import { Anatomy } from '../components/Anatomy';
import { TrendChart } from '../components/Chart';
import { muscleName } from '../lib/model';
import { BodyweightForm } from './Weight';
import { StreakCard } from '../components/WorkoutStreak';
import { SessionSuggestionCard } from '../components/SessionSuggestion';
export function Today() {
  const { data, run } = useApp();
  const [days, setDays] = useState(7);
  const [weightOpen, setWeightOpen] = useState(false);
  const active = data.sessions.find((s) => s.status === 'active');
  const sessions = useMemo(() => completedSessions(data, days), [data, days]);
  const stats = sessions.map((s) => sessionStats(data, s));
  const total = stats.reduce(
    (a, b) => ({
      sets: a.sets + b.sets,
      volume: a.volume + b.volume,
      minutes: a.minutes + b.minutes,
    }),
    { sets: 0, volume: 0, minutes: 0 },
  );
  const muscles = useMemo(() => muscleContributions(data, days), [data, days]);
  const top = [...muscles].sort((a, b) => b.sets - a.sets).slice(0, 4);
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return { date: d, ...dayStats(data, dateKey(d)) };
  });
  const count = week.reduce((n, d) => n + d.count, 0);
  const records = useMemo(
    () =>
      personalRecords(data)
        .filter((r) =>
          [
            'Estimated 1RM',
            'Heaviest load',
            'Most reps in a set',
            'Longest set',
            'Furthest set',
          ].includes(r.kind),
        )
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 3),
    [data],
  );
  const plans = data.plans
    .filter((p) => p.status === 'planned' && p.date >= dateKey(new Date()))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);
  const weightTrend = useMemo(
    () =>
      bodyweightTrend(data)
        .filter((w) => {
          const at = Date.parse(w.at);
          return at <= Date.now() && (!days || at >= Date.now() - days * 86400000);
        })
        .map((w) => ({
          date: dateLabel(w.at),
          value: fromKg(w.kg, data.settings.unit),
          average: fromKg(w.average, data.settings.unit),
        })),
    [data.bodyweights, data.settings.unit, days],
  );
  const highlights = useMemo(() => {
    const recent = completedSessions(data, days);
    const ids = [...new Set(recent.flatMap((s) => s.items.map((i) => i.exerciseId)))];
    return ids
      .flatMap((id) => {
        const exercise = data.exercises.find((e) => e.id === id);
        if (!exercise) return [];
        const history = exerciseHistory(data, id, exercise.tracking);
        if (!history.length) return [];
        const measure = (entry: (typeof history)[number]) =>
          exercise.tracking === 'duration'
            ? entry.sets.reduce((n, s) => n + (s.durationSeconds || 0), 0)
            : exercise.tracking === 'distance'
              ? entry.sets.reduce((n, s) => n + (s.distanceM || 0), 0)
              : exercise.tracking === 'weighted' || exercise.tracking === 'loaded_bodyweight'
                ? fromKg(entry.volume, data.settings.unit)
                : entry.reps;
        const unit =
          exercise.tracking === 'duration'
            ? 'sec'
            : exercise.tracking === 'distance'
              ? 'm'
              : exercise.tracking === 'weighted' || exercise.tracking === 'loaded_bodyweight'
                ? `${data.settings.unit} volume`
                : 'reps';
        const delta = history[1] ? measure(history[0]) - measure(history[1]) : undefined;
        return [{ exercise, latest: history[0], value: measure(history[0]), unit, delta }];
      })
      .slice(0, 3);
  }, [data, days]);
  return (
    <>
      <PageTitle
        eyebrow={new Date()
          .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
          .toUpperCase()}
        title="Make room for progress."
        description="Your training, your pace. Every set adds up."
        action={
          <select
            aria-label="Dashboard date range"
            className="range-select"
            value={days}
            onChange={(e) => setDays(+e.target.value)}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={0}>All time</option>
          </select>
        }
      />
      <div className="dashboard-top">
        <section className="training-hero">
          <div className="hero-content">
            <Badge>YOUR NEXT CHAPTER</Badge>
            <h2>
              {active ? 'Pick up where\nyou left off.' : 'A little stronger.\nEvery session.'}
            </h2>
            <p>
              {active
                ? `${active.name} · your sets are saved on this device.`
                : 'A clear plan. A focused session. A record of everything you put in.'}
            </p>
            <AsyncButton
              onAction={async () => {
                if (active) go('workout');
                else
                  await run(async () => {
                    await startSession();
                    go('workout');
                  });
              }}
            >
              <Play size={16} fill="currentColor" />
              {active ? 'Resume workout' : 'Start a workout'}
              <ArrowUpRight size={17} />
            </AsyncButton>
            <a href="#/routines">
              Or choose a routine <ChevronRight size={14} />
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit one" />
            <div className="orbit two" />
            <div className="orbit three" />
            <div className="barbell">
              <i />
              <i />
              <span />
              <i />
              <i />
            </div>
            <div className="hero-art-caption">SHOW UP. BUILD UP.</div>
          </div>
        </section>
        <Card className="week-card">
          <SectionTitle title="This week" action={<CalendarDays size={18} />} />
          <div className="week-count">
            <strong>{count}</strong>
            <span>/ {data.settings.weekTarget} workouts</span>
          </div>
          <div className="week-dots">
            {week.map((d) => (
              <div
                key={dateKey(d.date)}
                className={dateKey(d.date) === dateKey(new Date()) ? 'today' : ''}
              >
                <span>{d.date.toLocaleDateString('en-GB', { weekday: 'narrow' })}</span>
                <a
                  href={`#/calendar?date=${dateKey(d.date)}`}
                  aria-label={`${dateLabel(d.date.toISOString())}, ${d.count} workouts`}
                  className={d.count ? 'done' : ''}
                >
                  {d.count ? <Check size={16} /> : d.date.getDate()}
                </a>
              </div>
            ))}
          </div>
          <p>
            {count
              ? `${count} session${count === 1 ? '' : 's'} in the books. Keep your own rhythm.`
              : 'A fresh week of possibilities. Rest days count, too.'}
          </p>
        </Card>
      </div>
      <SessionSuggestionCard />
      <StreakCard />
      <div className="metric-grid">
        <Metric
          label="Workouts"
          value={sessions.length}
          icon={<Dumbbell size={18} />}
          foot={days ? `Completed in the last ${days} days` : 'Your complete training history'}
        />
        <Metric
          label="Working sets"
          value={total.sets}
          icon={<Layers size={18} />}
          foot="Warm-ups kept separate"
        />
        <Metric
          label="Training volume"
          value={fmt(fromKg(total.volume, data.settings.unit), 0)}
          unit={data.settings.unit}
          icon={<TrendingUp size={18} />}
          foot="External load × reps · working sets"
        />
        <Metric
          label="Time invested"
          value={fmt(total.minutes / 60, 1)}
          unit="hrs"
          icon={<Clock3 size={18} />}
          foot="Time in completed sessions"
        />
      </div>
      <div className="dashboard-middle">
        <Card className="muscle-dashboard">
          <SectionTitle
            title="The work, mapped."
            sub={`${days ? `Last ${days} days` : 'All time'} · weighted set contributions`}
            action={<LinkButton to="muscles">Explore</LinkButton>}
          />
          <div className="muscle-dashboard-body">
            <Anatomy
              small
              values={Object.fromEntries(muscles.map((m) => [m.muscle, m.sets]))}
              max={data.settings.muscleScale}
              onSelect={(m) => go(`muscles?muscle=${m}`)}
            />
            <div className="muscle-overview">
              {top.map((m) => (
                <div key={m.muscle}>
                  <div>
                    <span>{muscleName(m.muscle)}</span>
                    <strong>
                      {fmt(m.sets)} <small>sets</small>
                    </strong>
                  </div>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${Math.min(100, (m.sets / data.settings.muscleScale) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <p>
                {total.sets
                  ? 'Primary + secondary contributions. Tap a muscle to inspect its sets.'
                  : 'Your first completed workout will bring this map to life.'}
              </p>
            </div>
          </div>
          <div className="heat-legend">
            <span>No recorded work</span>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <span>More contribution</span>
          </div>
        </Card>
        <Card>
          <SectionTitle
            title="Your routines"
            sub="Less deciding. More doing."
            action={<LinkButton to="routines">View all</LinkButton>}
          />
          <div className="routine-shortcuts">
            {data.routines.slice(0, 3).map((r, i) => (
              <button
                key={r.id}
                className="routine-shortcut"
                onClick={() => go('routines?routine=' + r.id)}
              >
                <span
                  className="routine-number"
                  style={{ background: r.color + '1b', color: 'var(--ink)' }}
                >
                  0{i + 1}
                </span>
                <span>
                  <strong>{r.name}</strong>
                  <small>
                    {r.items.length} exercises · {r.items.reduce((n, e) => n + e.sets.length, 0)}{' '}
                    planned sets
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {plans.map((p) => (
            <div className="upcoming" key={p.id}>
              <CalendarDays size={17} />
              <span>
                <small>UP NEXT · {dateLabel(p.date + 'T12:00:00')}</small>
                <strong>{p.name}</strong>
              </span>
              <AsyncButton
                variant="ghost"
                onAction={() =>
                  run(async () => {
                    await startSession(p);
                    go('workout');
                  })
                }
              >
                <Play size={17} />
              </AsyncButton>
            </div>
          ))}
          <Button variant="secondary" className="full-width" onClick={() => go('routines?new=1')}>
            <Plus size={16} />
            Create a routine
          </Button>
        </Card>
      </div>
      <div className="dashboard-bottom">
        <Card>
          <SectionTitle
            title="Recent sessions"
            sub="Your effort, recorded."
            action={<LinkButton to="history">All history</LinkButton>}
          />
          {completedSessions(data).length ? (
            <div className="session-list">
              {completedSessions(data)
                .slice(0, 3)
                .map((s) => {
                  const stat = sessionStats(data, s);
                  return (
                    <a className="session-row" key={s.id} href={`#/history?session=${s.id}`}>
                      <span className="date-tile">
                        <small>
                          {new Date(s.startAt).toLocaleDateString('en-GB', { month: 'short' })}
                        </small>
                        <strong>{new Date(s.startAt).getDate()}</strong>
                      </span>
                      <span>
                        <strong>{s.name}</strong>
                        <small>
                          {stat.sets} sets · {fmt(stat.minutes, 0)} min ·{' '}
                          {fmt(fromKg(stat.volume, data.settings.unit), 0)} {data.settings.unit}
                        </small>
                      </span>
                      <ArrowUpRight size={18} />
                    </a>
                  );
                })}
            </div>
          ) : (
            <Empty title="Your story starts with a set" compact>
              Completed sessions will appear here. Start a workout whenever you’re ready.
            </Empty>
          )}
        </Card>
        <Card>
          <SectionTitle
            title="Small wins, real progress"
            sub="Personal records from your training."
            action={<LinkButton to="records">Records</LinkButton>}
          />
          {records.length ? (
            <div className="record-mini">
              {records.map((r) => (
                <a href={`#/progress?exercise=${r.exerciseId}`} key={r.exerciseId + r.kind}>
                  <span className="record-symbol">↗</span>
                  <span>
                    <strong>{r.exercise}</strong>
                    <small>{r.kind}</small>
                  </span>
                  <b>
                    {fmt(r.unit === 'kg' ? fromKg(r.value, data.settings.unit) : r.value)}{' '}
                    <small>{r.unit === 'kg' ? data.settings.unit : r.unit}</small>
                  </b>
                </a>
              ))}
            </div>
          ) : (
            <Empty title="Earn your first personal record" compact>
              Log your training to build a baseline. Records update as your history grows.
            </Empty>
          )}
        </Card>
      </div>
      <div className="dashboard-bottom">
        <Card>
          <SectionTitle
            title="Bodyweight trend"
            sub="Recorded measurements + a 7-day moving average."
            action={<LinkButton to="weight">View history</LinkButton>}
          />
          {weightTrend.length ? (
            <TrendChart
              data={weightTrend}
              unit={data.settings.unit}
              label="Bodyweight"
              zeroBaseline={false}
              secondary="average"
            />
          ) : (
            <Empty title="Start with a measurement" compact>
              Log bodyweight to see your own trend. Missing days stay unrecorded.
            </Empty>
          )}
          <Button variant="secondary" onClick={() => setWeightOpen(true)}>
            <Plus size={15} />
            Log bodyweight
          </Button>
        </Card>
        <Card>
          <SectionTitle
            title="Exercise progression"
            sub="Latest session totals compared with the previous session."
            action={<LinkButton to="progress">Explore</LinkButton>}
          />
          {highlights.length ? (
            <div className="record-mini">
              {highlights.map((h) => (
                <a key={h.exercise.id} href={`#/progress?exercise=${h.exercise.id}`}>
                  <span className="record-symbol">
                    <TrendingUp size={17} />
                  </span>
                  <span>
                    <strong>{h.exercise.name}</strong>
                    <small>
                      {h.delta === undefined
                        ? 'First-session baseline'
                        : `${h.delta > 0 ? '+' : ''}${fmt(h.delta)} ${h.unit} vs previous`}{' '}
                      · {dateLabel(h.latest.session.startAt)}
                    </small>
                  </span>
                  <b>
                    {fmt(h.value)} <small>{h.unit}</small>
                  </b>
                </a>
              ))}
            </div>
          ) : (
            <Empty title="Build your progression baseline" compact>
              Completed working sets will create exercise comparisons here.
            </Empty>
          )}
        </Card>
      </div>
      <div className="dashboard-footer">
        <div>
          <ShieldCheck size={16} />
          <span>Saved on your device. Yours to keep.</span>
          <a href="#/settings">
            Back up your data <ArrowUpRight size={13} />
          </a>
        </div>
        <Button variant="ghost" onClick={() => setWeightOpen(true)}>
          <Weight size={16} />
          Log bodyweight
        </Button>
      </div>
      {weightOpen && <BodyweightForm onClose={() => setWeightOpen(false)} />}
    </>
  );
}
