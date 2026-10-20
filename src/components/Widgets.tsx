const PracticeWidget = lazy(() =>
  import('./PracticeWidgets').then((m) => ({ default: m.PracticeWidget })),
);
import { WeeklyReviewView } from './WeeklyReview';
import { SuggestMealButton } from './MealSuggestions';
import { CombinedWeekWidget } from './WeekWidgets';
import { useMemo, useState, lazy, Suspense } from 'react';
import {
  Play,
  Plus,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Layers,
  TrendingUp,
  Clock3,
} from 'lucide-react';
import { useApp, go } from '../lib/context';
import { personalisation, linkName, destinations } from '../lib/personalisation';
import { startSession } from '../lib/actions';
import {
  completedSessions,
  sessionStats,
  exerciseHistory,
  personalRecords,
  calendarDays,
  dayStats,
  dateKey,
  dateLabel,
  fromKg,
  heatColor,
  fmt,
} from '../lib/calc';
import {
  foodDay,
  shiftDay,
  weekDays,
  dailyMacros,
  recordedEnergy,
  foodNumber,
  money,
  stockValue,
  plannedNutrition,
  convertQuantity,
  planRequirements,
} from '../lib/food-calc';
import { emptyFood, macroNames } from '../lib/food-model';
import { MUSCLES, muscleName, type Data, type Muscle } from '../lib/model';
import {
  defaultWorkspace,
  routeSystems,
  type System,
  type ViewRange,
  type Widget,
} from '../lib/workspace-model';
import { Button, AsyncButton, Empty, Metric } from './ui';
import { TrendChart } from './Chart';
import { Anatomy } from './Anatomy';
import { StreakCard } from './WorkoutStreak';
import { SessionSuggestionCard } from './SessionSuggestion';
import { MacroProgress } from '../pages/FoodDiary';
import { MacroSummary } from './FoodUI';
import { FoodTrainingContext } from './FoodOverview';
import { BodyweightForm } from '../pages/Weight';
import { WeightTagFilter } from './WeightTagFilter';
import { allWeights, type WeightFilter } from '../lib/weight-tags';
import { saveSettings } from '../lib/actions';
const ClimbingWidget = lazy(() =>
  import('./ClimbingWidgets').then((m) => ({ default: m.ClimbingWidget })),
);

import {
  rangeBounds,
  rangeData,
  widgetMuscles as muscleContributions,
  widgetWeightTrend as bodyweightTrend,
  widgetExerciseHistory,
} from '../lib/widget-registry';
export {
  WIDGETS,
  widgetDefinition,
  requiredSystems,
  rangeLabel,
  widgetDestination,
} from '../lib/widget-registry';

const Row = ({ name, value, href }: { name: string; value: string; href?: string }) => (
  <div className="widget-row">
    {href ? <a href={'#/' + href}>{name}</a> : <span>{name}</span>}
    <strong>{value}</strong>
  </div>
);

export function WidgetContent({
  widget: w,
  range,
  onWeightFilterChange,
}: {
  widget: Widget;
  range: ViewRange;
  onWeightFilterChange?: (filter: WeightFilter) => Promise<unknown>;
}) {
  const { data, run, streak, pending } = useApp();
  const c = w.config,
    r = c.range ?? range;
  const filtered = useMemo(() => rangeData(data, r), [data, r, streak.today]);
  const food = data.food ?? emptyFood;
  const currency = food.foodSettings.currency;
  const today = c.date ?? foodDay();
  const { start, end } = rangeBounds(r);
  const from = dateKey(new Date(start)),
    to = dateKey(new Date(end));
  const sessions = completedSessions(filtered);
  const [weightOpen, setWeightOpen] = useState(false);
  const active = data.sessions.find((s) => s.status === 'active');
  const [month, setMonth] = useState(new Date(today + 'T12:00:00'));
  const empty = (
    <Empty title="No records in this view" compact>
      Add records or choose a different date range. Missing information stays unrecorded.
    </Empty>
  );
  const exercise = data.exercises.find((e) => e.id === c.exerciseId);
  if (w.type === 'personal-goal')
    return (
      <>
        <p className="widget-number">
          {fmt(c.goalCurrent ?? 0)}
          <small>
            {' '}
            / {fmt(c.goalTarget ?? 10)} {c.goalUnit ?? ''}
          </small>
        </p>
        <progress
          className="goal-progress"
          aria-label={w.title || 'Personal milestone'}
          value={Math.min(c.goalCurrent ?? 0, c.goalTarget ?? 10)}
          max={c.goalTarget ?? 10}
        />
        <p className="small-text muted">
          Manually recorded progress. Edit this widget to update your milestone.
        </p>
        {(c.goalCurrent ?? 0) >= (c.goalTarget ?? 10) &&
          personalisation(data.settings).feedback === 'messages' && <p>Milestone reached.</p>}
      </>
    );
  if (w.type === 'quick-actions')
    return (
      <div className="food-actions">
        {(c.quickLinks ?? ['workout', 'climbing-log', 'food-diary'])
          .filter((link) =>
            routeSystems(link).every((s) => (data.workspace ?? defaultWorkspace()).systems[s]),
          )
          .map((link) => (
            <a className="button secondary" key={link} href={'#/' + link}>
              {linkName(
                personalisation(data.settings),
                link,
                destinations.find(([id]) => id === link)?.[1] ?? link,
              )}
            </a>
          ))}
      </div>
    );
  if (w.type === 'weekly-review') return <WeeklyReviewView date={today} />;
  if (w.type === 'suggest-meal')
    return (
      <>
        <p>Choose from your recipes using recorded stock, time, cost and remaining gram goals.</p>
        <SuggestMealButton />
      </>
    );
  if (w.type === 'combined-week') return <CombinedWeekWidget date={today} />;
  if (w.type.startsWith('rocket-league-') || w.type.startsWith('football-'))
    return (
      <Suspense fallback={<p role="status">Opening practice view…</p>}>
        <PracticeWidget widget={w} range={range} />
      </Suspense>
    );
  if (w.type.startsWith('climbing-'))
    return (
      <Suspense fallback={<p role="status">Opening climbing view…</p>}>
        <ClimbingWidget type={w.type} from={from} to={to} config={c} />
      </Suspense>
    );
  if (w.type === 'start')
    return (
      <div className="widget-start workout-actions">
        {active && <p>{active.name}</p>}
        <AsyncButton
          onAction={() =>
            run(async () => {
              if (!active) await startSession();
              go('workout');
            })
          }
        >
          <Play size={16} />
          <span>{active ? 'Resume workout' : 'Start a workout'}</span>
        </AsyncButton>
        <Button variant="secondary" onClick={() => go('routines')}>
          <Dumbbell size={16} />
          <span>Choose a routine</span>
        </Button>
        <SessionSuggestionCard buttonOnly />
      </div>
    );
  if (w.type === 'suggestion') return <SessionSuggestionCard />;
  if (w.type === 'streak') return <StreakCard />;
  if (w.type === 'week') {
    const week = weekDays(foodDay());
    const count = data.sessions.filter(
      (s) =>
        s.status === 'completed' && dateKey(s.startAt) >= week[0] && dateKey(s.startAt) <= week[6],
    ).length;
    return (
      <>
        <p className="widget-number">
          {count}
          <small> / {data.settings.weekTarget} workouts</small>
        </p>
        <div className="widget-week">
          {week.map((day) => (
            <a
              key={day}
              href={'#/calendar?date=' + day}
              className={
                data.sessions.some((s) => s.status === 'completed' && dateKey(s.startAt) === day)
                  ? 'done'
                  : ''
              }
            >
              <span>
                {new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' })}
              </span>
              <b>{+day.slice(-2)}</b>
            </a>
          ))}
        </div>
      </>
    );
  }
  if (w.type === 'training-totals') {
    const stats = sessions.map((s) => sessionStats(filtered, s));
    const total = (k: 'sets' | 'volume' | 'minutes') => stats.reduce((n, s) => n + s[k], 0);
    return (
      <>
        {!sessions.length && (
          <p>
            Your story starts with a set · <a href="#/records">Earn your first personal record</a>
          </p>
        )}
        <div className="widget-metrics">
          <Metric icon={<Dumbbell size={18} />} label="Workouts" value={sessions.length} />
          <Metric
            icon={<Layers size={18} />}
            label="Working sets"
            value={total('sets')}
            foot="Warm-ups kept separate"
          />
          <Metric
            icon={<TrendingUp size={18} />}
            label="Training volume"
            value={fmt(fromKg(total('volume'), data.settings.unit), 0)}
            unit={data.settings.unit}
          />
          <Metric
            icon={<Clock3 size={18} />}
            label="Time invested"
            value={fmt(total('minutes') / 60)}
            unit="hrs"
            foot="Date-only imports have no recorded duration"
          />
        </div>
      </>
    );
  }
  if (w.type === 'training-trend')
    return (
      <TrendChart
        label="Training"
        unit={c.metric === 'sets' ? 'sets' : c.metric === 'duration' ? 'min' : data.settings.unit}
        data={[...sessions].reverse().map((s) => {
          const t = sessionStats(data, s);
          return {
            date: dateLabel(s.startAt),
            day: dateKey(s.startAt),
            value:
              c.metric === 'sets'
                ? t.sets
                : c.metric === 'duration'
                  ? t.minutes
                  : fromKg(t.volume, data.settings.unit),
          };
        })}
      />
    );
  if (w.type === 'routines')
    return (
      <>
        {data.routines.slice(0, 4).map((s) => (
          <Row
            key={s.id}
            name={s.name}
            value={s.items.length + ' exercises'}
            href={'routines?routine=' + s.id}
          />
        ))}
        {data.plans
          .filter((p) => p.date >= foodDay() && p.status === 'planned')
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 3)
          .map((p) => (
            <Row key={p.id} name={p.name} value={p.date} href={'calendar?date=' + p.date} />
          ))}
        <Button variant="secondary" onClick={() => go('routines?new=1')}>
          Create a routine
        </Button>
      </>
    );
  if (w.type === 'sessions')
    return sessions.length ? (
      <>
        {sessions.slice(0, 6).map((s) => (
          <Row
            key={s.id}
            name={s.name + ' · ' + dateLabel(s.startAt)}
            value={sessionStats(data, s).sets + ' sets'}
            href={'history?session=' + s.id}
          />
        ))}
      </>
    ) : (
      empty
    );
  if (w.type === 'records') {
    const records = personalRecords(filtered)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6);
    return records.length ? (
      <>
        {records.map((p) => (
          <Row
            key={p.exerciseId + p.kind + p.contextKey}
            name={p.exercise + ' · ' + p.kind + (p.context ? ' · ' + p.context : '')}
            value={
              fmt(p.unit === 'kg' ? fromKg(p.value, data.settings.unit) : p.value) +
              ' ' +
              (p.unit === 'kg' ? data.settings.unit : p.unit)
            }
            href={'history?session=' + p.sessionId}
          />
        ))}
      </>
    ) : (
      empty
    );
  }
  if (w.type.startsWith('exercise')) {
    if (!exercise)
      return (
        <Empty title="Choose an exercise" compact>
          Configure this widget to match an exercise in your library.
        </Empty>
      );
    const expected = c.tracking ?? exercise.tracking;
    const all = widgetExerciseHistory(data, c);
    const history = all.filter(
      (h) => Date.parse(h.session.startAt) >= start && Date.parse(h.session.startAt) <= end,
    );
    if (!history.length) return empty;
    const weighted = ['weighted', 'loaded_bodyweight', 'assisted'].includes(expected);
    if (['volume', 'bestLoad', 'bestMax'].includes(c.metric) && !weighted)
      return <p>Select reps, sets, duration or distance for this tracking type.</p>;
    if (c.metric === 'bestMax' && expected !== 'weighted')
      return <p>Estimated maximum is available for weighted repetitions only.</p>;
    const bases = new Set(
      history.flatMap((h) => h.sets.map((s) => s.setup?.basis ?? 'unspecified')),
    );
    const setupIds = new Set(
      history.flatMap((h) => h.sets.map((s) => s.setup?.id ?? 'unspecified')),
    );
    if (
      (bases.size > 1 || setupIds.size > 1) &&
      ['volume', 'bestLoad', 'bestMax'].includes(c.metric)
    )
      return (
        <p>
          These records use different equipment or load conventions. Select a matching setup and
          load convention before comparing loads.
        </p>
      );
    if (w.type === 'exercise-comparison') {
      const index = all.findIndex((h) => h.session.id === history[0].session.id);
      const old = all[index + 1];
      const latest = history[0];
      return (
        <>
          <h3>{exercise.name}</h3>
          <Row
            name="Latest"
            value={dateLabel(latest.session.startAt)}
            href={'history?session=' + latest.session.id}
          />
          <Row
            name="Repetitions"
            value={
              fmt(latest.reps) +
              (old ? ' · ' + fmt(latest.reps - old.reps) + ' vs previous' : ' · first baseline')
            }
          />
          <Row name="Working sets" value={String(latest.sets.length)} />
          {old && (
            <Row
              name="Previous session"
              value={dateLabel(old.session.startAt)}
              href={'history?session=' + old.session.id}
            />
          )}
        </>
      );
    }
    const unit = ['volume', 'bestLoad', 'bestMax'].includes(c.metric)
      ? data.settings.unit
      : c.metric === 'duration'
        ? 'sec'
        : c.metric === 'distance'
          ? 'm'
          : c.metric;
    return (
      <>
        <p>
          {exercise.name} · {expected.replaceAll('_', ' ')} ·{' '}
          {c.basis?.replaceAll('_', ' ') ?? 'recorded load convention'}
        </p>
        <TrendChart
          label={exercise.name + ' ' + c.metric}
          unit={unit}
          data={[...history].reverse().map((h) => ({
            date: dateLabel(h.session.startAt),
            day: dateKey(h.session.startAt),
            value:
              c.metric === 'sets'
                ? h.sets.length
                : c.metric === 'reps'
                  ? h.reps
                  : c.metric === 'duration'
                    ? h.sets.reduce((n, s) => n + (s.durationSeconds ?? 0), 0)
                    : c.metric === 'distance'
                      ? h.sets.reduce((n, s) => n + (s.distanceM ?? 0), 0)
                      : fromKg(
                          h[
                            c.metric === 'bestMax'
                              ? 'bestMax'
                              : c.metric === 'bestLoad'
                                ? 'bestLoad'
                                : 'volume'
                          ],
                          data.settings.unit,
                        ),
          }))}
        />
      </>
    );
  }
  if (w.type === 'highlights') {
    const ids = [...new Set(sessions.flatMap((s) => s.items.map((i) => i.exerciseId)))].slice(0, 5);
    return ids.length ? (
      <>
        {ids.map((id) => {
          const h = exerciseHistory(data, id);
          return (
            <Row
              key={id}
              name={data.exercises.find((e) => e.id === id)?.name ?? id}
              value={
                h[0]
                  ? `${h[0].reps} reps${h[1] ? ' · ' + fmt(h[0].reps - h[1].reps) + ' vs previous' : ' · First-session baseline'}`
                  : 'No completed working sets'
              }
              href={'progress?exercise=' + id}
            />
          );
        })}
      </>
    ) : (
      empty
    );
  }
  if (w.type === 'bodyweight' || w.type === 'weight-summary') {
    const weightFilter = c.weightFilter ?? data.settings.weightFilter ?? allWeights;
    const trend = bodyweightTrend(data, weightFilter);
    const latest = trend.at(-1);
    const rows = trend.filter((w) => Date.parse(w.at) >= start && Date.parse(w.at) <= end);
    const avg = (days: number) => {
      const entries = trend.filter(
        (w) => Date.parse(w.at) <= Date.now() && Date.parse(w.at) >= Date.now() - days * 86400000,
      );
      return entries.length
        ? fmt(fromKg(entries.reduce((n, w) => n + w.kg, 0) / entries.length, data.settings.unit))
        : '—';
    };
    return (
      <>
        <WeightTagFilter
          disabled={pending}
          entries={data.bodyweights}
          value={weightFilter}
          onChange={(filter) => {
            void run(() =>
              onWeightFilterChange
                ? onWeightFilterChange(filter)
                : saveSettings({ weightFilter: filter }),
            );
          }}
        />
        {w.type === 'bodyweight' ? (
          rows.length ? (
            <TrendChart
              label="Bodyweight"
              unit={data.settings.unit}
              secondary="average"
              zeroBaseline={false}
              data={rows.map((w) => ({
                date: dateLabel(w.at),
                day: dateKey(w.at),
                value: fromKg(w.kg, data.settings.unit),
                average: fromKg(w.average, data.settings.unit),
              }))}
            />
          ) : (
            <Empty title="Start with a measurement" compact>
              Log bodyweight to see your own trend. Missing days stay unrecorded.
            </Empty>
          )
        ) : (
          <>
            <Row
              name="Latest measurement"
              value={
                latest
                  ? fmt(fromKg(latest.kg, data.settings.unit)) + ' ' + data.settings.unit
                  : 'Not recorded'
              }
            />
            <Row name="7-day average" value={avg(7) + ' ' + data.settings.unit} />
            <Row name="30-day average" value={avg(30) + ' ' + data.settings.unit} />
            <Row
              name="Goal"
              value={
                data.settings.goalKg
                  ? fmt(fromKg(data.settings.goalKg, data.settings.unit)) + ' ' + data.settings.unit
                  : 'Not set'
              }
            />
          </>
        )}
        <Button variant="secondary" onClick={() => setWeightOpen(true)}>
          <Plus size={15} />
          Log bodyweight
        </Button>
        {weightOpen && (
          <BodyweightForm
            initialTags={weightFilter.kind === 'tag' ? [weightFilter.tag] : []}
            onClose={() => setWeightOpen(false)}
          />
        )}
      </>
    );
  }
  if (w.type.startsWith('muscle')) {
    const period = start ? (end - start) / 86400000 : 0;
    const all = muscleContributions(data, period, end);
    const selected = MUSCLES.includes(c.muscle as Muscle) ? (c.muscle as Muscle) : 'chest';
    const current = all.find((m) => m.muscle === selected)!;
    const value = (m: typeof current) =>
      c.mode === 'recovery' ? m.recentLoad : c.mode === 'score' ? m.score : m.sets;
    if (w.type === 'muscle-map')
      return (
        <>
          <Anatomy
            small
            values={Object.fromEntries(all.map((m) => [m.muscle, value(m)]))}
            max={c.relative ? Math.max(1, ...all.map(value)) : data.settings.muscleScale}
            onSelect={(m) => go('muscles?muscle=' + m)}
          />
          <p className="small-text muted">
            {c.mode === 'recovery'
              ? 'Recent training estimate; more colour means more recent work, not measured recovery.'
              : c.mode === 'score'
                ? 'Relative volume score, not measured muscle activation.'
                : 'Primary and secondary weighted set contributions.'}
          </p>
          <details>
            <summary>Accessible muscle totals</summary>
            {all.map((m) => (
              <Row
                key={m.muscle}
                name={muscleName(m.muscle)}
                value={fmt(value(m))}
                href={'muscles?muscle=' + m.muscle}
              />
            ))}
          </details>
        </>
      );
    if (w.type === 'muscle-trend') {
      const daily = new Map<string, number>();
      current.details.forEach((d) => {
        const day = dateKey(d.session.startAt);
        daily.set(day, (daily.get(day) ?? 0) + (c.mode === 'sets' ? d.contribution : d.score));
      });
      return (
        <>
          <TrendChart
            label={muscleName(selected)}
            unit={c.mode === 'sets' ? 'contributions' : 'relative points'}
            data={[...daily]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, value]) => ({ date: dateLabel(date + 'T12:00:00'), day: date, value }))}
          />
          {c.mode === 'recovery' && (
            <p>Trend shows recorded relative volume before recovery decay.</p>
          )}
        </>
      );
    }
    if (w.type === 'muscle-compare') {
      const old =
        period > 0
          ? muscleContributions(data, period, end - period * 86400000 - 1).find(
              (m) => m.muscle === selected,
            )
          : undefined;
      return old ? (
        <>
          <h3>{muscleName(selected)}</h3>
          <Row
            name="Set contributions: current / preceding"
            value={fmt(current.sets) + ' / ' + fmt(old.sets)}
          />
          <Row
            name="Relative score: current / preceding"
            value={fmt(current.score) + ' / ' + fmt(old.score)}
          />
          <p>Equal {fmt(period)}-day windows. These estimates do not measure growth or recovery.</p>
        </>
      ) : (
        <p>Choose a bounded period to compare equal windows.</p>
      );
    }
    return (
      <>
        <h3>{muscleName(selected)}</h3>
        <Row name="Contributions" value={fmt(current.sets)} />
        <Row
          name="Primary / secondary"
          value={fmt(current.primary) + ' / ' + fmt(current.secondary)}
        />
        {current.details.slice(0, 10).map((d) => (
          <Row
            key={d.set.id}
            name={d.exercise + ' · ' + dateLabel(d.session.startAt)}
            value={fmt(d.contribution)}
            href={'history?session=' + d.session.id}
          />
        ))}
      </>
    );
  }
  if (w.type === 'calendar')
    return (
      <>
        <div className="inline-actions">
          <Button
            variant="ghost"
            aria-label="Previous widget month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} />
          </Button>
          <strong>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</strong>
          <Button
            variant="ghost"
            aria-label="Next widget month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <div className="widget-calendar">
          {calendarDays(month.getFullYear(), month.getMonth()).map((d) => {
            const key = dateKey(d),
              s = dayStats(data, key);
            const plans = data.plans.filter((p) => p.date === key);
            return (
              <a
                key={key}
                href={'#/calendar?date=' + key}
                className={s.count ? 'done' : ''}
                style={
                  s.count
                    ? {
                        background: heatColor(
                          Math.min(
                            1,
                            (c.calendarMetric === 'consistency'
                              ? s.count
                              : c.calendarMetric === 'volume'
                                ? s.volume
                                : c.calendarMetric === 'duration'
                                  ? s.duration
                                  : s.sets) /
                              (c.calendarMetric === 'consistency' ? 1 : c.calendarMax),
                          ),
                          1,
                        ),
                      }
                    : undefined
                }
                aria-label={`${key}, ${s.count} completed, ${plans.length} plans`}
              >
                <span>{d.getDate()}</span>
                <small>
                  {s.count
                    ? s.count + ' done'
                    : plans.some((p) => p.status === 'rest')
                      ? 'Rest'
                      : plans.length
                        ? 'Plan'
                        : ''}
                </small>
              </a>
            );
          })}
        </div>
        <p className="small-text muted">Completed workouts, plans and rest remain distinct.</p>
      </>
    );
  if (w.type === 'macros')
    return (
      <>
        <MacroProgress date={today} />
        {!food.foodEntries.some((e) => e.date === today) && (
          <p className="small-text muted">
            No food logged for this date. These totals cover recorded entries only.
          </p>
        )}
      </>
    );
  if (w.type === 'macro-summary') {
    const dates = [
      ...new Set(food.foodEntries.filter((e) => e.date >= from && e.date <= to).map((e) => e.date)),
    ];
    return (
      <>
        {Object.entries(macroNames).map(([key, label]) => {
          const metric = key as keyof typeof macroNames,
            known = dates
              .map((date) => dailyMacros(food, date)[metric])
              .filter((n): n is number => n !== undefined);
          return (
            <Row
              key={key}
              name={
                label +
                ' · ' +
                (known.length === dates.length ? 'recorded total' : 'known subtotal')
              }
              value={foodNumber(known.length ? known.reduce((a, b) => a + b, 0) : undefined) + ' g'}
            />
          );
        })}
        {food.foodSettings.showCalories &&
          (() => {
            const energy = recordedEnergy(
              food.foodEntries.filter((e) => e.date >= from && e.date <= to),
            );
            return (
              <Row
                name={
                  'Estimated calories · ' + (energy.missing ? 'known subtotal' : 'recorded total')
                }
                value={foodNumber(energy.total, 0) + ' kcal'}
              />
            );
          })()}
        <p>
          {dates.length} days with food logged. Unlogged days and incomplete macros stay unknown.
        </p>
      </>
    );
  }
  if (w.type === 'upcoming-meals') {
    const plans = food.mealPlans
      .filter((p) => p.date >= today && p.date <= shiftDay(today, 6))
      .sort((a, b) => a.date.localeCompare(b.date));
    return plans.length ? (
      <>
        {plans.slice(0, 12).map((p) => (
          <Row
            key={p.id}
            name={
              p.date +
              ' · ' +
              p.slot +
              ' · ' +
              (food.recipes.find((r) => r.id === p.recipeId)?.name ?? 'Unavailable recipe')
            }
            value={foodNumber(p.servings) + ' servings'}
            href={'food-planner?date=' + p.date}
          />
        ))}
        {plans.length > 12 && <p>Open the meal planner for all upcoming meals.</p>}
      </>
    ) : (
      <p>No meals planned in the next seven days.</p>
    );
  }
  if (w.type === 'shortages') {
    const rows = planRequirements(food, today, shiftDay(today, 6)).filter(
      (r) => r.shortage === undefined || r.shortage > 0,
    );
    return rows.length ? (
      <>
        {rows.slice(0, 10).map((r) => (
          <Row
            key={r.ingredientId}
            name={food.ingredients.find((i) => i.id === r.ingredientId)?.name ?? 'Ingredient'}
            value={foodNumber(r.shortage) + ' ' + r.unit}
            href="food-shopping"
          />
        ))}
        <p>Planned requirements after recorded usable stock.</p>
      </>
    ) : (
      <p>No unmet ingredient requirements in the next seven days of recorded plans.</p>
    );
  }

  if (w.type === 'macro-trend') {
    const metric = (
      ['protein', 'carbs', 'fat', 'fibre'].includes(c.metric) ? c.metric : 'protein'
    ) as keyof typeof macroNames;
    const dates = [
      ...new Set(food.foodEntries.filter((e) => e.date >= from && e.date <= to).map((e) => e.date)),
    ].sort();
    const known = dates.filter((d) => dailyMacros(food, d)[metric] !== undefined);
    return (
      <>
        <TrendChart
          label={macroNames[metric]}
          unit="g"
          data={known.map((d) => ({
            date: dateLabel(d + 'T12:00:00'),
            day: d,
            value: dailyMacros(food, d)[metric]!,
          }))}
        />
        <p className="small-text muted">
          Recorded days only. {dates.length - known.length} logged days have incomplete values;
          unlogged days stay missing.
        </p>
      </>
    );
  }
  if (w.type === 'meal-plan') {
    const plans = food.mealPlans.filter((p) => p.date === today);
    return (
      <>
        {plans.length ? (
          plans.map((p) => (
            <Row
              key={p.id}
              name={
                p.slot +
                ' · ' +
                (food.recipes.find((r) => r.id === p.recipeId)?.name ?? 'Recipe unavailable')
              }
              value={foodNumber(p.servings) + ' servings'}
              href={'food-planner?date=' + today}
            />
          ))
        ) : (
          <p>No meals planned for {today}.</p>
        )}
        <Button variant="secondary" onClick={() => go('food-planner?date=' + today)}>
          Plan a meal
        </Button>
      </>
    );
  }
  if (w.type === 'expiry' || w.type === 'stock') {
    const stock = food.stock.filter(
      (s) =>
        s.quantity > 0 &&
        (w.type !== 'expiry' ||
          (s.expires && s.expires >= today && s.expires <= shiftDay(today, 3))),
    );
    return stock.length ? (
      <>
        {stock.slice(0, 10).map((s) => (
          <Row
            key={s.id}
            name={
              (food.ingredients.find((i) => i.id === s.ingredientId)?.name ?? 'Ingredient') +
              ' · ' +
              s.location
            }
            value={`${foodNumber(s.quantity)} ${s.unit} · ${w.type === 'expiry' ? s.expires : s.confidence}`}
            href="food-kitchen"
          />
        ))}
        {stock.length > 10 && <p>{stock.length - 10} more packages in Kitchen.</p>}
      </>
    ) : (
      <p>
        {w.type === 'expiry'
          ? 'No recorded package expiry in the next three days.'
          : 'No remaining stock recorded.'}
      </p>
    );
  }
  if (w.type === 'batches')
    return (
      <>
        {food.batches
          .filter((b) => b.remaining > 0)
          .map((b) => (
            <Row
              key={b.id}
              name={food.recipes.find((r) => r.id === b.recipeId)?.name ?? 'Prepared batch'}
              value={foodNumber(b.remaining) + ' portions · ' + b.location}
              href="food-kitchen"
            />
          ))}
        {!food.batches.some((b) => b.remaining > 0) && <p>No prepared portions recorded.</p>}
      </>
    );
  if (w.type === 'shopping')
    return (
      <>
        {food.shoppingLists.length ? (
          food.shoppingLists
            .slice(0, 5)
            .map((l) => (
              <Row
                key={l.id}
                name={l.name}
                value={`${l.items.filter((i) => i.checked).length}/${l.items.length} checked · ${l.items.filter((i) => i.received).length} received`}
                href="food-shopping"
              />
            ))
        ) : (
          <p>No shopping lists yet.</p>
        )}
      </>
    );
  const purchases = food.purchases.filter(
    (p) => p.currency === currency && p.date >= from && p.date <= to,
  );
  if (w.type === 'spending') {
    const week =
      c.spendingPeriod === 'month'
        ? [foodDay().slice(0, 7) + '-01', foodDay()]
        : weekDays(foodDay());
    const total = food.purchases
      .filter((p) => p.currency === currency && p.date >= week[0] && p.date <= week.at(-1)!)
      .reduce((n, p) => n + p.total, 0);
    const budget =
      c.spendingPeriod === 'month'
        ? food.foodSettings.monthlyBudget
        : food.foodSettings.weeklyBudget;
    return (
      <>
        <p className="widget-number">{money(total, currency)}</p>
        {budget ? (
          <>
            <progress aria-label="Food budget used" value={Math.min(total, budget)} max={budget} />
            <p>
              {money(budget - total, currency)} remaining of {money(budget, currency)}
            </p>
          </>
        ) : (
          <p>Budget disabled.</p>
        )}
        <p className="small-text muted">
          Confirmed checkout spending · current {c.spendingPeriod} · {currency} only.
        </p>
      </>
    );
  }
  if (w.type === 'spending-trend') {
    const dates = [...new Set(purchases.map((p) => p.date))].sort();
    return (
      <TrendChart
        label="Checkout spending"
        unit={currency}
        data={dates.map((d) => ({
          date: dateLabel(d + 'T12:00:00'),
          day: d,
          value: purchases.filter((p) => p.date === d).reduce((n, p) => n + p.total, 0),
        }))}
      />
    );
  }
  if (w.type === 'retailer')
    return (
      <>
        {[...new Set(purchases.map((p) => p.retailer))].map((name) => (
          <Row
            key={name}
            name={name || 'Unspecified retailer'}
            value={money(
              purchases.filter((p) => p.retailer === name).reduce((n, p) => n + p.total, 0),
              currency,
            )}
          />
        ))}
        {!purchases.length && empty}
      </>
    );
  if (w.type === 'stock-value') {
    const stock = food.stock.filter((s) => s.quantity > 0);
    const values = stock.map((s) => stockValue(s, currency));
    return (
      <>
        <p className="widget-number">
          {money(
            values.reduce<number>((n, v) => n + (v ?? 0), 0),
            currency,
          )}
        </p>
        <p>
          Estimated remaining value. {values.filter((v) => v === undefined).length} packages have
          unknown or different-currency values.
        </p>
      </>
    );
  }
  if (w.type === 'consumption') {
    const entries = food.foodEntries.filter((e) => e.date >= from && e.date <= to);
    const known = entries.filter(
      (e) => e.snapshot.cost !== undefined && (e.snapshot.currency ?? 'GBP') === currency,
    );
    const plans = food.mealPlans
      .filter((p) => p.date >= foodDay() && p.date <= shiftDay(foodDay(), 6))
      .map((p) => plannedNutrition(food, p));
    const forecast =
      plans.length && plans.every((p) => p.cost !== undefined && (p.currency ?? 'GBP') === currency)
        ? plans.reduce((n, p) => n + p.cost!, 0)
        : undefined;
    return (
      <>
        <Row
          name="Recorded consumption estimate"
          value={money(
            known.reduce((n, e) => n + e.snapshot.cost! * e.servings, 0),
            currency,
          )}
        />
        <p>{entries.length - known.length} entries lack comparable costs.</p>
        <Row name="Next 7 days planned ingredient cost" value={money(forecast, currency)} />
        <p>Ingredient-use estimates are separate from checkout spending.</p>
      </>
    );
  }
  if (w.type === 'waste') {
    const waste = food.movements.filter(
      (m) => m.kind === 'waste' && m.at.slice(0, 10) >= from && m.at.slice(0, 10) <= to,
    );
    const known = waste.filter((m) => m.cost !== undefined && (m.currency ?? 'GBP') === currency);
    return (
      <>
        <Row name="Waste events" value={String(waste.length)} />
        <Row
          name="Known estimated waste cost"
          value={money(
            known.reduce((n, m) => n + m.cost!, 0),
            currency,
          )}
        />
        <p>{waste.length - known.length} events have unknown or different-currency costs.</p>
      </>
    );
  }
  if (w.type === 'prices') {
    const ingredient = food.ingredients.find((i) => i.id === c.ingredientId);
    if (!ingredient) return <p>Choose an ingredient in this widget’s settings.</p>;
    const rows = purchases
      .flatMap((p) =>
        p.lines
          .filter((l) => l.ingredientId === ingredient.id)
          .map((l) => {
            const amount = l.quantity
              ? convertQuantity(l.quantity * l.packages, l.unit, ingredient.defaultUnit, ingredient)
              : undefined;
            return {
              date: p.date,
              retailer: p.retailer,
              value: amount ? l.paid / amount : undefined,
            };
          }),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    return (
      <>
        <p>
          {ingredient.name} · {currency} per {ingredient.defaultUnit}
        </p>
        <TrendChart
          label="Recorded unit price"
          unit={currency + '/' + ingredient.defaultUnit}
          data={rows
            .filter((row) => row.value !== undefined)
            .map((row) => ({
              date: dateLabel(row.date + 'T12:00:00'),
              day: row.date,
              value: row.value!,
            }))}
        />
        <p>
          {rows.filter((row) => row.value === undefined).length} purchase lines cannot be
          normalised. No live prices.
        </p>
      </>
    );
  }
  if (w.type === 'context') return <FoodTrainingContext />;
  if (w.type === 'setups') {
    const next =
      data.plans
        .filter((p) => p.date >= foodDay() && p.status === 'planned')
        .sort((a, b) => a.date.localeCompare(b.date))[0] ??
      data.routines.find((r) => r.weekdays.includes(new Date().getDay()));
    const nextExercises = new Set((active ?? next)?.items.map((i) => i.exerciseId) ?? []);
    const profiles = (data.workspace ?? defaultWorkspace()).setups.filter(
      (s) =>
        !s.archived &&
        (c.exerciseId ? s.exerciseId === c.exerciseId : nextExercises.has(s.exerciseId)),
    );
    return (
      <>
        {profiles.length ? (
          profiles.slice(0, 6).map((s) => (
            <div key={s.id} className="widget-setup">
              <strong>
                {s.name}
                {s.gym ? ' · ' + s.gym : ''}
              </strong>
              <p>
                {s.machine} {s.settings} {s.attachment}
              </p>
              <p>{s.notes}</p>
              <small>{s.basis.replaceAll('_', ' ')}</small>
            </div>
          ))
        ) : (
          <p>No matching setups yet. Save reminders in Equipment setups.</p>
        )}
        <Button
          variant="secondary"
          onClick={() => go('setups' + (c.exerciseId ? '?exercise=' + c.exerciseId : ''))}
        >
          Manage equipment setups
        </Button>
      </>
    );
  }
  if (w.type === 'notes')
    return (
      <p className="widget-note">{c.note || 'Add your own reminders in this widget’s settings.'}</p>
    );
  if (w.type === 'shortcut')
    return (
      <Button onClick={() => go(c.link)}>
        {(
          {
            workout: 'Start or resume workout',
            routines: 'Choose a routine',
            history: 'Workout history',
            weight: 'Log bodyweight',
            'food-diary': 'Log food',
            'food-menu': 'Open menu',
            'food-planner': 'Plan meals',
            'food-shopping': 'Shopping',
            'paste-workouts': 'Paste workout notes',
          } as Record<string, string>
        )[c.link] ??
          linkName(
            personalisation(data.settings),
            c.link,
            destinations.find(([id]) => id === c.link)?.[1] ?? c.link,
          )}
      </Button>
    );
  return (
    <Empty title="Widget unavailable" compact>
      This widget type is not supported by this version. Its position is retained; remove it or
      update FORM.
    </Empty>
  );
}
