import {
  dateKey,
  bodyweightTrend as calculateWeight,
  muscleContributions as calculateMuscles,
  exerciseHistory as calculateExercise,
} from './calc';
import type { Data } from './model';
import {
  routeSystems,
  type System,
  type ViewRange,
  type Widget,
  type WidgetConfig,
} from './workspace-model';

export const WIDGETS = [
  [
    'combined-week',
    'Combined week planner',
    'Training, climbing and meal plans with completed records, for enabled systems.',
    'shared',
    'today',
  ],
  [
    'climbing-start',
    'Log climbing',
    'Start a session or resume a saved draft.',
    'climbing',
    'live',
  ],
  [
    'climbing-totals',
    'Climbing totals',
    'Recorded sessions, attempts, clean completions and time.',
    'climbing',
    'range',
  ],
  [
    'climbing-sessions',
    'Recent climbing sessions',
    'Completed sessions in the selected date range.',
    'climbing',
    'range',
  ],
  [
    'climbing-projects',
    'Climbing projects',
    'Active projects and beta for the next try.',
    'climbing',
    'live',
  ],
  [
    'climbing-grades',
    'Climbing grade log',
    'Attempts and completions grouped by discipline, venue and grade scale.',
    'climbing',
    'range',
  ],
  ['start', 'Start or resume', 'Jump into your saved workout.', 'gym', 'live'],
  [
    'suggestion',
    'Suggested session',
    'Review existing explainable progression targets.',
    'gym',
    'live',
  ],
  ['week', 'This week', 'Your weekly workout target and activity.', 'gym', 'today'],
  ['streak', 'Workout streak', 'Workout days and protected rest bank.', 'gym', 'live'],
  [
    'training-totals',
    'Training totals',
    'Workouts, working sets, volume and time.',
    'gym',
    'range',
  ],
  [
    'training-trend',
    'Training over time',
    'Recorded sessions by sets, volume or minutes.',
    'gym',
    'range',
  ],
  [
    'routines',
    'Routines & upcoming plans',
    'Shortcuts to your reusable routines and dated plans.',
    'gym',
    'live',
  ],
  ['sessions', 'Recent sessions', 'Completed sessions and their totals.', 'gym', 'range'],
  ['records', 'Personal records', 'Derived records linked to source sessions.', 'gym', 'range'],
  [
    'exercise',
    'Exercise progression',
    'A configurable exercise graph, with comparable tracking and filters.',
    'gym',
    'range',
  ],
  [
    'exercise-comparison',
    'Exercise comparison',
    'Latest comparable exercise session versus the previous.',
    'gym',
    'range',
  ],
  [
    'highlights',
    'Progression highlights',
    'Recent exercise totals compared with previous performances.',
    'gym',
    'range',
  ],
  [
    'bodyweight',
    'Bodyweight trend',
    'Raw readings and trailing seven-day average.',
    'shared',
    'range',
  ],
  [
    'weight-summary',
    'Bodyweight summary',
    'Latest, weekly, monthly and optional goal.',
    'shared',
    'live',
  ],
  [
    'muscle-map',
    'Muscle map',
    'Selectable contribution, relative-score or recent-load map.',
    'gym',
    'range',
  ],
  ['muscle-trend', 'Muscle trend', 'Daily contributions to a selected region.', 'gym', 'range'],
  [
    'muscle-summary',
    'Muscle sources',
    'Contribution totals and the sets behind them.',
    'gym',
    'range',
  ],
  [
    'muscle-compare',
    'Muscle period comparison',
    'Equal-length current and preceding training windows.',
    'gym',
    'range',
  ],
  ['calendar', 'Training calendar', 'Monthly completed, planned and rest days.', 'gym', 'month'],
  [
    'macro-summary',
    'Macro summary',
    'Recorded totals and logging coverage for the selected period.',
    'food',
    'range',
  ],
  ['upcoming-meals', 'Upcoming meals', 'Meals planned for the next seven days.', 'food', 'live'],
  [
    'shortages',
    'Kitchen shortages',
    'Unmet ingredient requirements for the next seven days.',
    'food',
    'live',
  ],
  ['macros', 'Daily macros', 'Recorded grams and optional target progress.', 'food', 'today'],
  [
    'macro-trend',
    'Macro trend',
    'Recorded daily macros, without filling missing days.',
    'food',
    'range',
  ],
  ['meal-plan', 'Planned meals', 'The selected day’s meal plan.', 'food', 'today'],
  [
    'expiry',
    'Approaching expiry',
    'Recorded expiry dates in the next three days.',
    'food',
    'today',
  ],
  [
    'stock',
    'Kitchen stock',
    'Remaining packages, units, locations and confidence.',
    'food',
    'live',
  ],
  ['batches', 'Prepared portions', 'Remaining prepared portions and storage.', 'food', 'live'],
  [
    'shopping',
    'Shopping progress',
    'Checked, outstanding and received list items.',
    'food',
    'live',
  ],
  ['spending', 'Food spending', 'Confirmed checkout spending and budget.', 'food', 'today'],
  [
    'spending-trend',
    'Spending over time',
    'Actual recorded spending in the selected currency.',
    'food',
    'range',
  ],
  ['retailer', 'Spending by retailer', 'Checkout totals grouped by retailer.', 'food', 'range'],
  [
    'stock-value',
    'Estimated stock value',
    'Known recorded value with incomplete costs labelled.',
    'food',
    'live',
  ],
  [
    'consumption',
    'Consumption & forecast',
    'Estimated consumed costs and next seven-day planned costs.',
    'food',
    'range',
  ],
  [
    'waste',
    'Recorded waste',
    'Recorded discarded food and available cost estimates.',
    'food',
    'range',
  ],
  [
    'prices',
    'Ingredient prices',
    'Comparable recorded unit prices, never live quotes.',
    'food',
    'range',
  ],
  [
    'context',
    'Training & food context',
    'Weekly observations alongside shared bodyweight; no causal claims.',
    'both',
    'today',
  ],
  [
    'setups',
    'Equipment reminders',
    'Saved setups for a selected exercise or the next session.',
    'gym',
    'live',
  ],
  ['notes', 'Personal notes', 'Your own reminders and training cues.', 'shared', 'live'],
  ['shortcut', 'Quick action', 'A chosen safe shortcut to a FORM tool.', 'shared', 'live'],
] as const;
export const widgetDefinition = (type: string) => WIDGETS.find((w) => w[0] === type);
export function requiredSystems(widget: Widget): System[] {
  const group = widgetDefinition(widget.type)?.[3];
  if (!group) return widget.dependencies ?? [];
  if (widget.type === 'shortcut') return routeSystems(widget.config.link);
  return group === 'both'
    ? ['gym', 'food']
    : group === 'gym' || group === 'food' || group === 'climbing'
      ? [group]
      : [];
}
export const rangeLabel = (r: ViewRange) =>
  r.from || r.to
    ? `${r.from ?? 'Beginning'} – ${r.to ?? 'Today'}`
    : r.days
      ? `Last ${r.days} days`
      : 'All time';
export function rangeBounds(range: ViewRange) {
  const end = range.to
    ? Math.min(Date.now(), new Date(range.to + 'T23:59:59.999').getTime())
    : Date.now();
  const localStart = new Date(end);
  localStart.setDate(localStart.getDate() - Math.max(0, range.days - 1));
  localStart.setHours(0, 0, 0, 0);
  const start = range.from
    ? new Date(range.from + 'T00:00:00').getTime()
    : range.days
      ? localStart.getTime()
      : 0;
  return { start, end };
}
const cache = new WeakMap<Data, Map<string, Data>>();
export function rangeData(data: Data, range: ViewRange): Data {
  let entries = cache.get(data);
  if (!entries) {
    entries = new Map();
    cache.set(data, entries);
  }
  const key = JSON.stringify(range) + dateKey(new Date());
  const old = entries.get(key);
  if (old) return old;
  const { start, end } = rangeBounds(range);
  const inside = (s: string) => Date.parse(s) >= start && Date.parse(s) <= end;
  const ids = new Set(data.sessions.filter((s) => inside(s.startAt)).map((s) => s.id));
  const result = {
    ...data,
    sessions: data.sessions.filter((s) => ids.has(s.id)),
    sets: data.sets.filter((s) => ids.has(s.sessionId)),
    bodyweights: data.bodyweights.filter((s) => inside(s.at)),
  };
  entries.set(key, result);
  return result;
}
export function widgetDestination(w: Widget) {
  if (w.type === 'combined-week') return 'week-planner';
  if (w.type.startsWith('climbing-'))
    return w.type === 'climbing-projects' ? 'climbing-projects' : 'climbing-log';
  const range = w.config.range;
  const query = new URLSearchParams();
  if (w.config.exerciseId) query.set('exercise', w.config.exerciseId);
  if (w.config.ingredientId) query.set('ingredient', w.config.ingredientId);
  if (w.config.date) query.set('date', w.config.date);
  if (range) {
    query.set('days', String(range.days));
    if (range.from) query.set('from', range.from);
    if (range.to) query.set('to', range.to);
  }
  const routes: Record<string, string> = {
    bodyweight: 'weight',
    'weight-summary': 'weight',
    calendar: 'calendar',
    records: 'records',
    sessions: 'history',
    routines: 'routines',
    setups: 'setups',
    macros: 'food-diary',
    'macro-trend': 'food-diary',
    'meal-plan': 'food-planner',
    expiry: 'food-kitchen',
    stock: 'food-kitchen',
    batches: 'food-kitchen',
    shopping: 'food-shopping',
    spending: 'food-budget',
    'spending-trend': 'food-budget',
    retailer: 'food-budget',
    'stock-value': 'food-budget',
    consumption: 'food-budget',
    waste: 'food-budget',
    prices: 'food-budget',
    'macro-summary': 'food-diary',
    'upcoming-meals': 'food-planner',
    shortages: 'food-shopping',
    context: 'food-diary',
    highlights: 'progress',
    'training-totals': 'history',
    'training-trend': 'history',
    week: 'calendar',
  };
  if (w.type.startsWith('exercise')) {
    query.set('metric', w.config.metric);
    if (w.config.tracking) query.set('tracking', w.config.tracking);
    if (w.config.setupId) query.set('setup', w.config.setupId);
    if (w.config.basis) query.set('basis', w.config.basis);
    if (w.config.includeWarmup) query.set('warmup', '1');
    for (const k of ['repMin', 'repMax', 'loadMinKg', 'loadMaxKg'] as const)
      if (w.config[k] !== undefined) query.set(k, String(w.config[k]));
    return 'progress?' + query;
  }
  if (w.type.startsWith('muscle')) {
    query.set('muscle', w.config.muscle);
    query.set('mode', w.config.mode);
    query.set('relative', String(w.config.relative));
    return 'muscles?' + query;
  }
  return (routes[w.type] ?? 'today') + (query.size ? '?' + query : '');
}

const analytics = new WeakMap<Data, Map<string, unknown>>();
function cached<T>(data: Data, key: string, calculate: () => T): T {
  let values = analytics.get(data);
  if (!values) {
    values = new Map();
    analytics.set(data, values);
  }
  if (values.has(key)) return values.get(key) as T;
  const result = calculate();
  values.set(key, result);
  return result;
}
export const widgetWeightTrend = (data: Data) =>
  cached(data, 'weight', () => calculateWeight(data));
export const widgetMuscles = (data: Data, days: number, at: number) =>
  cached(data, 'muscles:' + Math.round(days * 1440) + ':' + Math.floor(at / 60000), () =>
    calculateMuscles(data, days, at),
  );
export function widgetExerciseHistory(data: Data, c: WidgetConfig) {
  return cached(data, 'exercise:' + JSON.stringify(c), () => {
    const exercise = data.exercises.find((e) => e.id === c.exerciseId);
    if (!exercise) return [];
    const expected = c.tracking ?? exercise.tracking;
    const selected = {
      ...data,
      sets: data.sets
        .filter(
          (s) =>
            (c.includeWarmup || s.label !== 'warmup') &&
            (c.repMin === undefined || (s.reps ?? 0) >= c.repMin) &&
            (c.repMax === undefined || (s.reps ?? 0) <= c.repMax) &&
            (c.loadMinKg === undefined || (s.loadKg ?? 0) >= c.loadMinKg) &&
            (c.loadMaxKg === undefined || (s.loadKg ?? 0) <= c.loadMaxKg) &&
            (!c.setupId || s.setup?.id === c.setupId) &&
            (!c.basis || (s.setup?.basis ?? 'unspecified') === c.basis),
        )
        .map((s) =>
          c.includeWarmup && s.label === 'warmup' ? { ...s, label: 'working' as const } : s,
        ),
    };
    return calculateExercise(selected, exercise.id, expected);
  });
}
