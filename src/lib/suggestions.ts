import { dateKey, fromKg, roundTo, toKg } from './calc';
import type { Data, Item, Plan, Routine, Session, WorkoutSet } from './model';

export type SessionChoice = {
  key: string;
  source: Routine | Plan;
  kind: 'planned' | 'weekly' | 'routine';
  date?: string;
};
export type ExerciseSuggestion = {
  item: Item;
  previous: WorkoutSet[];
  change: 'weight' | 'reps' | 'hold' | 'baseline' | 'unchanged';
  reason: string;
};
export type SessionSuggestion = {
  choice: SessionChoice;
  source: Routine | Plan;
  previous?: Session;
  exercises: ExerciseSuggestion[];
};

/** Dated plans and weekly schedules first; unscheduled routines remain selectable. */
export function sessionChoices(data: Data, at = Date.now()): SessionChoice[] {
  const today = dateKey(new Date(at));
  const choices: SessionChoice[] = data.plans
    .filter((p) => p.status === 'planned' && p.date >= today && p.items.length > 0)
    .map((source) => ({ key: `plan:${source.id}`, source, kind: 'planned', date: source.date }));
  for (const routine of data.routines.filter((r) => r.items.length > 0)) {
    for (let offset = 0; offset <= 7; offset++) {
      const day = new Date(at);
      day.setHours(12, 0, 0, 0);
      day.setDate(day.getDate() + offset);
      const date = dateKey(day);
      if (!routine.weekdays.includes(day.getDay())) continue;
      if (
        data.plans.some(
          (p) => p.date === date && (p.status === 'rest' || p.routineId === routine.id),
        ) ||
        data.sessions.some(
          (s) =>
            s.status !== 'cancelled' && s.routineId === routine.id && dateKey(s.startAt) === date,
        )
      )
        continue;
      choices.push({ key: `weekly:${routine.id}:${date}`, source: routine, kind: 'weekly', date });
      break;
    }
  }
  choices.sort(
    (a, b) =>
      a.date!.localeCompare(b.date!) || Number(b.kind === 'planned') - Number(a.kind === 'planned'),
  );
  for (const source of data.routines.filter((r) => r.items.length > 0)) {
    if (
      !choices.some(
        (c) => ('weekdays' in c.source ? c.source.id : c.source.routineId) === source.id,
      )
    )
      choices.push({ key: `routine:${source.id}`, source, kind: 'routine' });
  }
  return choices;
}

const signature = (items: Item[]) => JSON.stringify(items.map((i) => [i.exerciseId, i.tracking]));
const isRepetition = (item: Item) => !['duration', 'distance'].includes(item.tracking);

/** Reviews only the same routine, keeping each occurrence of a repeated exercise separate. */
export function suggestSession(
  data: Data,
  choice: SessionChoice,
  at = Date.now(),
): SessionSuggestion {
  const source = structuredClone(choice.source);
  const routineId = 'weekdays' in source ? source.id : source.routineId;
  const history = data.sessions
    .filter(
      (s) =>
        s.status === 'completed' &&
        Date.parse(s.startAt) <= at &&
        (!s.endAt || Date.parse(s.endAt) <= at) &&
        (routineId ? s.routineId === routineId : signature(s.items) === signature(source.items)),
    )
    .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
  const completed = data.sets.filter(
    (s) =>
      s.completed && s.label !== 'warmup' && (!s.completedAt || Date.parse(s.completedAt) <= at),
  );
  const previous = history.find((s) => completed.some((set) => set.sessionId === s.id));
  const older =
    previous &&
    history
      .slice(history.indexOf(previous) + 1)
      .find((s) => completed.some((set) => set.sessionId === s.id));
  const matchingItem = (session: Session | undefined, item: Item, index: number) => {
    const occurrence = source.items
      .slice(0, index)
      .filter((i) => i.exerciseId === item.exerciseId && i.tracking === item.tracking).length;
    return session?.items.filter(
      (i) => i.exerciseId === item.exerciseId && i.tracking === item.tracking,
    )[occurrence];
  };
  const matchingSets = (session: Session | undefined, item: Item, index: number) => {
    const oldItem = matchingItem(session, item, index);
    return oldItem
      ? completed
          .filter((s) => s.sessionId === session!.id && s.itemId === oldItem.id)
          .sort((a, b) => a.order - b.order)
      : [];
  };
  const exercises = source.items.map((item, index): ExerciseSuggestion => {
    const sets = matchingSets(previous, item, index);
    const before = matchingSets(older, item, index);
    const planned = item.sets.filter((s) => s.label !== 'warmup');
    const result: ExerciseSuggestion = { item, previous: sets, change: 'baseline', reason: '' };
    if (!isRepetition(item) || !planned.length) {
      result.change = 'unchanged';
      result.reason =
        'Keep the routine’s time, distance or warm-up targets. No automatic increase.';
      return result;
    }
    if (!sets.length) {
      result.reason =
        'No comparable working sets in the last session of this routine. Keep your planned targets and choose a starting load.';
      return result;
    }
    const usable = sets.every(
      (s) => (s.reps || 0) > 0 && (item.tracking !== 'weighted' || (s.loadKg || 0) > 0),
    );
    if (!usable) {
      result.reason =
        'The previous sets do not provide a complete load/repetition baseline. Keep the planned targets.';
      return result;
    }
    const previousSlots =
      matchingItem(previous, item, index)
        ?.sets.map((set, order) => ({ set, order }))
        .filter(({ set }) => set.label !== 'warmup') || [];
    const enough =
      sets.length >= planned.length &&
      previousSlots.every(({ order }) => sets.some((set) => set.order === order));
    if (!enough) {
      result.change = 'hold';
      result.reason =
        'The previous exercise was incomplete or had fewer working sets. Keep the routine targets and review before starting.';
      return result;
    }
    const effort = sets.every(
      (s) =>
        s.label !== 'failure' &&
        (s.rpe === undefined || s.rpe <= data.settings.progressionRpe) &&
        (s.rir === undefined || s.rir >= 1),
    );
    const declined =
      before.length === sets.length &&
      before.length > 0 &&
      sets.reduce((n, s) => n + (s.reps || 0), 0) <
        before.reduce((n, s) => n + (s.reps || 0), 0) * 0.85 &&
      sets.every((s, i) => (s.loadKg || 0) <= (before[i].loadKg || 0));
    const weighted = ['weighted', 'loaded_bodyweight'].includes(item.tracking);
    const allHit = enough && sets.every((s) => (s.reps || 0) >= item.repMax);
    const increaseWeight = weighted && allHit && effort && !declined;
    const increaseReps =
      enough &&
      effort &&
      !declined &&
      sets.slice(0, planned.length).some((s) => s.reps! < item.repMax);
    result.change = increaseWeight ? 'weight' : increaseReps ? 'reps' : 'hold';
    result.reason = !effort
      ? 'High effort or a failure set was recorded. Repeat the targets before increasing.'
      : declined
        ? 'Total reps fell by more than 15% at the same or lower loads. Repeat the targets and review your recovery.'
        : increaseWeight
          ? `Every working set reached ${item.repMax} reps. Add a small load increment and return to ${item.repMin} reps.`
          : increaseReps
            ? `Keep the load and add up to ${data.settings.repIncrement} rep${data.settings.repIncrement === 1 ? '' : 's'} per working set, up to ${item.repMax}.`
            : 'The working sets are at the rep target. Repeat them or adjust the routine when ready.';
    if (effort && !sets.some((s) => s.rpe !== undefined || s.rir !== undefined))
      result.reason += ' Effort was not logged; review how the last session felt.';
    let workingIndex = 0;
    item.sets = item.sets.map((plannedSet) => {
      if (plannedSet.label === 'warmup') return plannedSet;
      const old = sets[workingIndex++];
      if (!old) return plannedSet;
      let loadKg = old.loadKg ?? plannedSet.loadKg;
      if (increaseWeight) {
        const display = fromKg(loadKg || 0, data.settings.unit);
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
        ...plannedSet,
        loadKg: item.tracking === 'bodyweight' ? plannedSet.loadKg : loadKg,
        reps: increaseWeight
          ? item.repMin
          : increaseReps
            ? Math.min(item.repMax, old.reps! + data.settings.repIncrement)
            : old.reps,
      };
    });
    return result;
  });
  return { choice, source, previous, exercises };
}
