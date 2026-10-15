import {
  MUSCLES,
  type Data,
  type Settings,
  type WorkoutSet,
  type Session,
  type Exercise,
  type Item,
  type Muscle,
} from './model';
export const LB_PER_KG = 2.2046226218487757;
export const fromKg = (kg: number, unit: 'kg' | 'lb') => (unit === 'lb' ? kg * LB_PER_KG : kg);
export const toKg = (value: number, unit: 'kg' | 'lb') =>
  unit === 'lb' ? value / LB_PER_KG : value;
export const roundTo = (n: number, step: number) => Math.round((n + Number.EPSILON) / step) * step;
export const fmt = (n: number, digits = 1) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(n);
export const dateKey = (date: string | Date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const dateLabel = (s: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(s).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short' });
export const working = (s: WorkoutSet) => s.completed && s.label !== 'warmup';
export function estimatedMax(
  load: number,
  reps: number,
  formula: Settings['formula'] = 'epley',
): number | undefined {
  if (!Number.isFinite(load) || !Number.isFinite(reps) || load <= 0 || reps <= 0 || reps > 12)
    return undefined;
  if (reps === 1) return load;
  return formula === 'epley' ? load * (1 + reps / 30) : (load * 36) / (37 - reps);
}
export function externalVolume(set: WorkoutSet, tracking: string): number {
  return working(set) && (tracking === 'weighted' || tracking === 'loaded_bodyweight')
    ? (set.loadKg || 0) * (set.reps || 0)
    : 0;
}
export function setMagnitude(
  set: WorkoutSet,
  item: Pick<Item, 'tracking' | 'includeBodyweight'>,
): number {
  if (!working(set)) return 0;
  if (item.tracking === 'duration') return set.durationSeconds || 0;
  if (item.tracking === 'distance') return set.distanceM || 0;
  if (
    item.tracking === 'weighted' ||
    (item.tracking === 'loaded_bodyweight' && !item.includeBodyweight)
  )
    return (set.loadKg || 0) * (set.reps || 0);
  if (item.includeBodyweight && set.bodyweightKg)
    return (
      Math.max(
        0,
        set.bodyweightKg + (item.tracking === 'assisted' ? -(set.loadKg || 0) : set.loadKg || 0),
      ) * (set.reps || 0)
    );
  return set.reps || 0;
}
export const itemFor = (data: Data, s: WorkoutSet) =>
  data.sessions.find((x) => x.id === s.sessionId)?.items.find((i) => i.id === s.itemId);
export function sessionSets(data: Data, id: string, includeWarmup = false) {
  return data.sets.filter(
    (s) => s.sessionId === id && s.completed && (includeWarmup || s.label !== 'warmup'),
  );
}
export function sessionStats(data: Data, session: Session) {
  const sets = sessionSets(data, session.id);
  return {
    sets: sets.length,
    reps: sets.reduce((n, s) => n + (s.reps || 0), 0),
    volume: sets.reduce(
      (n, s) => n + externalVolume(s, session.items.find((i) => i.id === s.itemId)?.tracking || ''),
      0,
    ),
    minutes: Math.max(
      0,
      ((session.endAt ? Date.parse(session.endAt) : Date.now()) - Date.parse(session.startAt)) /
        60000,
    ),
  };
}
export function completedSessions(data: Data, days = 0, at = Date.now()) {
  const since = days ? at - days * 86400000 : 0;
  return data.sessions
    .filter(
      (s) =>
        s.status === 'completed' && Date.parse(s.startAt) >= since && Date.parse(s.startAt) <= at,
    )
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
}
export function exerciseHistory(data: Data, exerciseId: string, trackingType?: string) {
  const expected = trackingType || data.exercises.find((e) => e.id === exerciseId)?.tracking;
  const grouped = new Map<string, WorkoutSet[]>();
  for (const set of data.sets) {
    if (set.exerciseId === exerciseId && working(set)) {
      const group = grouped.get(set.sessionId) || [];
      group.push(set);
      grouped.set(set.sessionId, group);
    }
  }
  return completedSessions(data).flatMap((session) => {
    const candidates = grouped.get(session.id);
    if (!candidates) return [];
    const items = session.items.filter(
      (i) => i.exerciseId === exerciseId && (!expected || i.tracking === expected),
    );
    const itemIds = new Set(items.map((i) => i.id));
    const sets = candidates
      .filter((set) => itemIds.has(set.itemId))
      .sort((a, b) => a.order - b.order);
    if (!sets.length) return [];
    const tracking = items[0]?.tracking;
    return [
      {
        session,
        sets,
        reps: sets.reduce((n, set) => n + (set.reps || 0), 0),
        volume: sets.reduce((n, set) => n + externalVolume(set, tracking || ''), 0),
        bestLoad: Math.max(...sets.map((set) => set.loadKg || 0)),
        bestMax:
          tracking === 'weighted'
            ? Math.max(
                0,
                ...sets.map(
                  (set) => estimatedMax(set.loadKg || 0, set.reps || 0, data.settings.formula) || 0,
                ),
              )
            : 0,
      },
    ];
  });
}

export function recommendation(data: Data, exercise: Exercise | Item) {
  const id = 'exerciseId' in exercise ? exercise.exerciseId : exercise.id;
  const h = exerciseHistory(data, id, exercise.tracking);
  const latest = h[0];
  const n = 'defaultSets' in exercise ? exercise.defaultSets : exercise.sets.length;
  if (!latest)
    return {
      loadKg: 0,
      reps: exercise.repMin,
      sets: n,
      rest: exercise.restSeconds,
      reason:
        'No completed history yet. Choose a comfortable starting load and log a session to establish a baseline.',
      increase: false,
    };
  const sets = latest.sets;
  const effort = sets.every(
    (s) =>
      (s.rpe === undefined || s.rpe <= data.settings.progressionRpe) &&
      (s.rir === undefined || s.rir >= 1),
  );
  const allHit = sets.length >= n && sets.every((s) => (s.reps || 0) >= exercise.repMax) && effort;
  const declined =
    h.length > 1 && latest.reps < h[1].reps * 0.85 && latest.bestLoad <= h[1].bestLoad;
  const weighted = exercise.tracking === 'weighted' || exercise.tracking === 'loaded_bodyweight';
  const increase = allHit && !declined && weighted;
  const last = sets[sets.length - 1];
  let loadKg = last.loadKg || 0;
  if (increase) {
    const display = fromKg(loadKg, data.settings.unit);
    loadKg = toKg(
      Math.max(
        display + data.settings.weightIncrement,
        roundTo(
          display * (1 + data.settings.progressionPercent / 100),
          data.settings.weightIncrement,
        ),
      ),
      data.settings.unit,
    );
  }
  return {
    loadKg,
    reps: increase ? exercise.repMin : last.reps || exercise.repMin,
    sets: n,
    rest: exercise.restSeconds,
    increase,
    reason: declined
      ? 'Repetitions fell compared with your previous session. Maintain the load and review rest and effort.'
      : increase
        ? `All ${sets.length} working sets reached ${exercise.repMax} reps within your effort settings. A small load increase is suggested; review it before training.`
        : `Previous session: ${sets.length} working sets, ${latest.reps} total reps. Maintain the load and work towards ${exercise.repMax} reps per set.`,
  };
}
export type RecordEntry = {
  exerciseId: string;
  exercise: string;
  kind: string;
  value: number;
  unit: string;
  sessionId: string;
  at: string;
  setId?: string;
};
export function personalRecords(data: Data): RecordEntry[] {
  return data.exercises.flatMap((e) => {
    const h = exerciseHistory(data, e.id).reverse();
    if (!h.length) return [];
    const records: RecordEntry[] = [];
    const add = (kind: string, value: number, unit: string, session: Session, setId?: string) => {
      if (value > 0)
        records.push({
          exerciseId: e.id,
          exercise: e.name,
          kind,
          value,
          unit,
          sessionId: session.id,
          at: session.startAt,
          setId,
        });
    };
    const all = h.flatMap((x) =>
      x.sets.map((s) => ({
        s,
        session: x.session,
        tracking: x.session.items.find((i) => i.id === s.itemId)?.tracking,
      })),
    );
    const best = (select: (s: WorkoutSet, t?: string) => number) =>
      all.reduce((a, b) => (select(b.s, b.tracking) > select(a.s, a.tracking) ? b : a));
    if (e.tracking === 'weighted' || e.tracking === 'loaded_bodyweight') {
      let b = best((s) => s.loadKg || 0);
      add('Heaviest load', b.s.loadKg || 0, 'kg', b.session, b.s.id);
      for (const reps of [...new Set(all.map((x) => x.s.reps || 0))].sort((a, b) => a - b)) {
        const matches = all.filter((x) => x.s.reps === reps);
        const top = matches.reduce((a, b) => ((b.s.loadKg || 0) > (a.s.loadKg || 0) ? b : a));
        add(`Load × ${reps} reps`, top.s.loadKg || 0, 'kg', top.session, top.s.id);
      }
      if (e.tracking === 'weighted') {
        b = best((s) => estimatedMax(s.loadKg || 0, s.reps || 0, data.settings.formula) || 0);
        add(
          'Estimated 1RM',
          estimatedMax(b.s.loadKg || 0, b.s.reps || 0, data.settings.formula) || 0,
          'kg',
          b.session,
          b.s.id,
        );
      }
      const v = h.reduce((a, b) => (b.volume > a.volume ? b : a));
      add('Session external volume', v.volume, 'kg', v.session);
    }
    if (e.tracking === 'duration') {
      const b = best((s) => s.durationSeconds || 0);
      add('Longest set', b.s.durationSeconds || 0, 'seconds', b.session, b.s.id);
    } else if (e.tracking === 'distance') {
      const b = best((s) => s.distanceM || 0);
      add('Furthest set', b.s.distanceM || 0, 'metres', b.session, b.s.id);
    } else {
      const b = best((s) => s.reps || 0);
      add('Most reps in a set', b.s.reps || 0, 'reps', b.session, b.s.id);
      for (const load of [...new Set(all.map((x) => x.s.loadKg || 0))]) {
        const matches = all.filter((x) => (x.s.loadKg || 0) === load);
        const top = matches.reduce((a, b) => ((b.s.reps || 0) > (a.s.reps || 0) ? b : a));
        add(
          `Reps at ${fmt(fromKg(load, data.settings.unit))} ${data.settings.unit}`,
          top.s.reps || 0,
          'reps',
          top.session,
          top.s.id,
        );
      }
      const total = h.reduce((a, b) => (b.reps > a.reps ? b : a));
      add('Total session reps', total.reps, 'reps', total.session);
    }
    const count = h.reduce((a, b) => (b.sets.length > a.sets.length ? b : a));
    add('Working sets in a session', count.sets.length, 'sets', count.session);
    return records;
  });
}
export type Contribution = {
  muscle: Muscle;
  sets: number;
  primary: number;
  secondary: number;
  score: number;
  recentLoad: number;
  details: {
    set: WorkoutSet;
    session: Session;
    exercise: string;
    contribution: number;
    score: number;
    role: string;
  }[];
};
export function muscleContributions(data: Data, days = 7, at = Date.now()): Contribution[] {
  const sessions = new Map(
    data.sessions.filter((s) => s.status === 'completed').map((s) => [s.id, s]),
  );
  const items = new Map<string, Item>();
  for (const session of sessions.values())
    for (const item of session.items) items.set(session.id + '|' + item.id, item);
  const baselineValues = new Map<string, number[]>();
  const keyFor = (set: WorkoutSet, item: Item) =>
    set.exerciseId + '|' + item.tracking + '|' + item.includeBodyweight;
  for (const set of data.sets) {
    if (!working(set) || !sessions.has(set.sessionId)) continue;
    const item = items.get(set.sessionId + '|' + set.itemId);
    if (!item) continue;
    const magnitude = setMagnitude(set, item);
    if (magnitude > 0) {
      const key = keyFor(set, item);
      const values = baselineValues.get(key) || [];
      values.push(magnitude);
      baselineValues.set(key, values);
    }
  }
  const baselines = new Map<string, number>();
  for (const [key, values] of baselineValues) {
    values.sort((a, b) => a - b);
    baselines.set(key, values[Math.floor(values.length / 2)]);
  }
  const mappings = new Map<string, Data['mappings']>();
  for (const mapping of data.mappings) {
    const list = mappings.get(mapping.exerciseId) || [];
    list.push(mapping);
    mappings.set(mapping.exerciseId, list);
  }
  const names = new Map(data.exercises.map((e) => [e.id, e.name]));
  const results = new Map<Muscle, Contribution>(
    MUSCLES.map((muscle) => [
      muscle,
      { muscle, sets: 0, primary: 0, secondary: 0, score: 0, recentLoad: 0, details: [] },
    ]),
  );
  const since = days ? at - days * 86400000 : 0;
  for (const set of data.sets) {
    if (!working(set)) continue;
    const session = sessions.get(set.sessionId);
    if (!session || Date.parse(session.startAt) < since || Date.parse(session.startAt) > at)
      continue;
    const item = items.get(set.sessionId + '|' + set.itemId);
    if (!item) continue;
    const magnitude = setMagnitude(set, item);
    const normalised =
      magnitude > 0
        ? Math.min(3, Math.max(0.25, magnitude / (baselines.get(keyFor(set, item)) || 1)))
        : 0;
    for (const mapping of mappings.get(set.exerciseId) || []) {
      const result = results.get(mapping.muscle)!;
      const contribution =
        mapping.contribution *
        (mapping.role === 'primary' ? data.settings.primaryFactor : data.settings.secondaryFactor);
      const score = normalised * contribution;
      result.sets += contribution;
      result[mapping.role] += contribution;
      result.score += score;
      const hours = Math.max(0, (at - Date.parse(session.endAt || session.startAt)) / 3600000);
      result.recentLoad += score * Math.pow(0.5, hours / data.settings.recoveryHours);
      result.details.push({
        set,
        session,
        exercise: names.get(set.exerciseId) || item.name,
        contribution,
        score,
        role: mapping.role,
      });
    }
  }
  return [...results.values()];
}

export const contributionColors = [
  '#dce2dc',
  '#bd635d',
  '#d99555',
  '#dccb63',
  '#a8c977',
  '#4f8566',
];
export function heatColor(value: number, max: number) {
  if (value <= 0) return contributionColors[0];
  return contributionColors[Math.min(5, Math.max(1, Math.ceil((value / Math.max(1, max)) * 5)))];
}
export function calendarDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}
export function dayStats(data: Data, key: string) {
  const sessions = data.sessions.filter(
    (s) => s.status === 'completed' && dateKey(s.startAt) === key,
  );
  return sessions.reduce(
    (a, s) => {
      const t = sessionStats(data, s);
      return {
        count: a.count + 1,
        sets: a.sets + t.sets,
        volume: a.volume + t.volume,
        duration: a.duration + t.minutes,
      };
    },
    { count: 0, sets: 0, volume: 0, duration: 0 },
  );
}
export function bodyweightTrend(data: Data) {
  const entries = [...data.bodyweights].sort((a, b) => a.at.localeCompare(b.at));
  return entries.map((e) => {
    const t = Date.parse(e.at);
    const start = new Date(e.at);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    const window = entries.filter(
      (w) => Date.parse(w.at) <= t && Date.parse(w.at) >= start.getTime(),
    );
    return { ...e, average: window.reduce((n, w) => n + w.kg, 0) / window.length };
  });
}
export function compare(
  current: ReturnType<typeof exerciseHistory>[number],
  previous: ReturnType<typeof exerciseHistory>[number],
) {
  return {
    reps: current.reps - previous.reps,
    load: current.bestLoad - previous.bestLoad,
    max: current.bestMax - previous.bestMax,
    volume: current.volume - previous.volume,
    sets: current.sets.length - previous.sets.length,
    volumePercent: previous.volume > 0 ? (current.volume / previous.volume - 1) * 100 : undefined,
  };
}
