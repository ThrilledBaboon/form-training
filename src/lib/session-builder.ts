import { dateKey } from './calc';
import { catalogue } from './catalogue';
import {
  muscleName,
  type Data,
  type Exercise,
  type Item,
  type Muscle,
  type Routine,
} from './model';
import {
  defaultSuggestionPreferences,
  type Readiness,
  type SuggestionPreferences,
} from './suggestion-preferences';
import {
  suggestSession,
  type ExerciseSuggestion,
  type SessionChoice,
  type SessionSuggestion,
} from './suggestions';

type Role = 'push' | 'pull' | 'squat' | 'hinge' | 'accessory';
const compounds: Record<string, Role> = {
  'barbell bench press': 'push',
  'incline bench press': 'push',
  'dumbbell bench press': 'push',
  'overhead press': 'push',
  'push-up': 'push',
  'pull-up': 'pull',
  'weighted pull-up': 'pull',
  'assisted pull-up': 'pull',
  'lat pulldown': 'pull',
  'barbell row': 'pull',
  'seated cable row': 'pull',
  'back squat': 'squat',
  'air squat': 'squat',
  'leg press': 'squat',
  'walking lunge': 'squat',
  'romanian deadlift': 'hinge',
  'conventional deadlift': 'hinge',
  'hip thrust': 'hinge',
};
export const suggestionRole = (e: Exercise): Role =>
  e.suggestionRole ?? compounds[e.name.toLowerCase()] ?? 'accessory';
const shoulders: Muscle[] = ['front_delts', 'side_delts', 'rear_delts'];
const primary = (data: Data, id: string) =>
  data.mappings
    .filter((m) => m.exerciseId === id && m.role === 'primary' && m.contribution > 0)
    .map((m) => m.muscle);
const available = (e: Exercise, p: SuggestionPreferences) =>
  !e.archived &&
  !p.excludedExerciseIds.includes(e.id) &&
  (!p.equipment.length || p.equipment.includes(e.equipment));

/** Recorded work only: no planned sets, unfinished sessions, future work or circuit rounds. */
export function recordedCoverage(data: Data, days: number, at: number) {
  const since = days ? at - days * 86400000 : 0;
  const sessions = new Map(
    data.sessions
      .filter(
        (s) =>
          s.status === 'completed' &&
          !s.benchmark &&
          Date.parse(s.startAt) >= since &&
          Date.parse(s.startAt) <= at &&
          (!s.endAt || Date.parse(s.endAt) <= at),
      )
      .map((s) => [s.id, s]),
  );
  const coverage = new Map<Muscle, number>();
  const uses = new Map<string, number>();
  for (const set of data.sets) {
    const session = sessions.get(set.sessionId);
    if (
      !session ||
      !set.completed ||
      set.label === 'warmup' ||
      (set.completedAt && Date.parse(set.completedAt) > at)
    )
      continue;
    const item = session.items.find((i) => i.id === set.itemId && i.exerciseId === set.exerciseId);
    if (!item) continue;
    uses.set(
      item.exerciseId,
      Math.max(uses.get(item.exerciseId) ?? 0, Date.parse(session.startAt)),
    );
    for (const m of data.mappings.filter((m) => m.exerciseId === item.exerciseId)) {
      const contribution =
        m.contribution *
        (m.role === 'primary' ? data.settings.primaryFactor : data.settings.secondaryFactor);
      coverage.set(m.muscle, (coverage.get(m.muscle) ?? 0) + contribution);
    }
  }
  return { coverage, uses };
}

function context(data: Data, p: SuggestionPreferences, readiness: Readiness, at: number) {
  const recorded = recordedCoverage(data, p.coverageDays, at);
  const familiar = recordedCoverage(data, 0, at).uses;
  const today = dateKey(new Date(at));
  const next = new Date(at);
  next.setDate(next.getDate() + 3);
  const nextDay = dateKey(next);
  const planned = p.respectSchedule
    ? data.plans
        .filter((plan) => plan.status === 'planned' && plan.date > today && plan.date <= nextDay)
        .flatMap((plan) => plan.items.map((i) => i.exerciseId))
    : [];
  if (p.respectSchedule) {
    for (let offset = 1; offset <= 3; offset++) {
      const day = new Date(at);
      day.setDate(day.getDate() + offset);
      const date = dateKey(day);
      for (const routine of data.routines) {
        if (
          !routine.weekdays.includes(day.getDay()) ||
          data.plans.some(
            (plan) =>
              plan.date === date && (plan.status === 'rest' || plan.routineId === routine.id),
          )
        )
          continue;
        planned.push(...routine.items.map((i) => i.exerciseId));
      }
    }
  }
  const yesterday = new Date(at);
  yesterday.setDate(yesterday.getDate() - 1);
  const recentClimb =
    p.considerClimbing &&
    (data.climbing?.sessions.some(
      (s) => s.status === 'completed' && s.date >= dateKey(yesterday) && s.date <= today,
    ) ||
      data.climbing?.plans.some((s) => s.date >= today && s.date <= nextDay));
  const warnings: string[] = [];
  if (recentClimb)
    warnings.push(
      'Climbing is logged recently or planned within three days. Pulling and grip accessories receive less emphasis; no climbing rounds or attempts are converted to gym sets.',
    );
  if (readiness !== 'normal')
    warnings.push(
      readiness === 'low_energy'
        ? 'Low energy: automatic increases are paused and newly built exercises use fewer working sets.'
        : readiness === 'tired_grip'
          ? 'Tired grip: pulling and grip accessories receive less emphasis. The full-body pull slot stays in place; review it before starting.'
          : 'Sore legs: extra leg accessories receive less emphasis. The full-body leg slot stays in place; choose a different session if needed.',
    );
  const score = (e: Exercise, projected: Map<Muscle, number>, seed = 0) => {
    const muscles = primary(data, e.id);
    const gaps = muscles.length
      ? muscles.reduce((n, m) => n + 1 / (1 + (projected.get(m) ?? 0)), 0) / muscles.length
      : 0;
    let result =
      (p.balanceCoverage ? gaps * 8 : 0) +
      (muscles.length
        ? muscles.filter((m) => p.priorityMuscles.includes(m)).length / muscles.length
        : 0) *
        3;
    const used = recorded.uses.get(e.id);
    if (p.familiarity === 'familiar' && familiar.has(e.id)) result += 2;
    if (p.familiarity === 'variety' && used)
      result -= Math.max(0, 4 * (1 - (at - used) / (p.coverageDays * 86400000)));
    if (planned.includes(e.id)) result -= 4;
    if (
      (recentClimb || readiness === 'tired_grip') &&
      muscles.some((m) => ['lats', 'upper_back', 'biceps', 'forearms'].includes(m))
    )
      result -= 4;
    if (
      readiness === 'sore_legs' &&
      muscles.some((m) => ['quads', 'hamstrings', 'glutes', 'calves'].includes(m))
    )
      result -= 5;
    if (seed)
      result +=
        ((Array.from(e.id).reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0), seed) >>> 0) %
          1000) /
        80;
    return result;
  };
  return { ...recorded, score, warnings };
}

function makeItem(
  data: Data,
  e: Exercise,
  key: string,
  p: SuggestionPreferences,
  readiness: Readiness,
): Item {
  const sets = readiness === 'low_energy' ? 2 : 3;
  return {
    id: `suggested:${key}`,
    exerciseId: e.id,
    name: e.name,
    tracking: e.tracking,
    includeBodyweight: e.includeBodyweight,
    notes: '',
    setup: data.workspace?.setups.find((s) => s.exerciseId === e.id && s.isDefault && !s.archived),
    repMin: e.repMin,
    repMax: e.repMax,
    restSeconds: e.restSeconds,
    sets: Array.from({ length: sets }, () =>
      e.tracking === 'duration'
        ? { label: 'working', durationSeconds: 30 }
        : { label: 'working', reps: e.repMin || 8 },
    ),
    ...(p.includeWarmup && suggestionRole(e) !== 'accessory'
      ? { notes: 'Warm-up load is left for you to choose.' }
      : {}),
  };
}
const shell = (at: number, items: Item[] = []): Routine => ({
  id: 'suggested-full-body',
  name: 'Balanced full body',
  description: 'Push, pull and legs first; accessories selected for your preferences.',
  weekdays: [],
  groups: [],
  color: '#597e69',
  createdAt: new Date(at).toISOString(),
  updatedAt: new Date(at).toISOString(),
  items,
});
function reviewItem(
  data: Data,
  item: Item,
  p: SuggestionPreferences,
  readiness: Readiness,
  at: number,
) {
  const source = shell(at, [item]);
  const result = suggestSession(
    data,
    { key: source.id, kind: 'generated', source },
    at,
    { progression: readiness === 'low_energy' ? 'off' : p.progression },
    true,
  ).exercises[0];
  if (
    p.includeWarmup &&
    suggestionRole(data.exercises.find((e) => e.id === item.exerciseId)!) !== 'accessory' &&
    !item.sets.some((s) => s.label === 'warmup') &&
    !['duration', 'distance'].includes(item.tracking)
  )
    result.item.sets.unshift({
      label: 'warmup',
      reps: 5,
      notes: 'Choose a comfortable warm-up load.',
    });
  return result;
}
export function estimateSessionMinutes(items: Item[]) {
  return Math.ceil(
    items.reduce(
      (total, item) =>
        total +
        60 +
        item.sets.reduce(
          (n, set, i) =>
            n +
            (set.durationSeconds ?? (set.label === 'warmup' ? 30 : 45)) +
            (i < item.sets.length - 1 ? (set.restSeconds ?? item.restSeconds) : 0),
          0,
        ),
      0,
    ) / 60,
  );
}
function addProjected(data: Data, map: Map<Muscle, number>, item: Item) {
  const count = item.sets.filter((s) => s.label !== 'warmup').length;
  for (const m of data.mappings.filter((m) => m.exerciseId === item.exerciseId))
    map.set(
      m.muscle,
      (map.get(m.muscle) ?? 0) +
        count *
          m.contribution *
          (m.role === 'primary' ? data.settings.primaryFactor : data.settings.secondaryFactor),
    );
}
function selectionReason(
  data: Data,
  e: Exercise,
  slot: string,
  p: SuggestionPreferences,
  coverage: Map<Muscle, number>,
) {
  const muscles = primary(data, e.id);
  const priority = muscles.filter((m) => p.priorityMuscles.includes(m));
  const least = [...muscles].sort((a, b) => (coverage.get(a) ?? 0) - (coverage.get(b) ?? 0))[0];
  return [
    slot === 'accessory' ? 'Accessory slot' : `Core ${slot} movement`,
    priority.length ? `Priority: ${priority.map(muscleName).join(', ')}` : '',
    p.balanceCoverage && least
      ? `${muscleName(least)}: ${Math.round((coverage.get(least) ?? 0) * 10) / 10} estimated sets recorded over ${p.coverageDays} days`
      : '',
    !muscles.length ? 'No primary muscle mapping; excluded from coverage estimates' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
function appendAccessories(
  data: Data,
  result: SessionSuggestion,
  p: SuggestionPreferences,
  readiness: Readiness,
  at: number,
  seed: number,
  locks: Record<string, Item>,
) {
  const ctx = context(data, p, readiness, at);
  const projected = new Map(ctx.coverage);
  result.source.items.forEach((i) => addProjected(data, projected, i));
  for (let index = 0; index < p.accessoryLimit; index++) {
    const slotKey = `accessory:${index}`;
    const used = new Set(result.source.items.map((i) => i.exerciseId));
    let candidates = data.exercises.filter(
      (e) =>
        available(e, p) &&
        e.tracking !== 'distance' &&
        suggestionRole(e) === 'accessory' &&
        !used.has(e.id),
    );
    // Reserve direct shoulder work when requested and the compound choices did not provide it.
    const needsShoulders =
      (result.choice.kind === 'generated' ||
        p.priorityMuscles.some((m) => shoulders.includes(m))) &&
      !result.source.items.some((i) =>
        primary(data, i.exerciseId).some((m) => shoulders.includes(m)),
      );
    const needsChest =
      result.choice.kind === 'generated' &&
      !result.source.items.some((i) => primary(data, i.exerciseId).includes('chest'));
    const required: Muscle[] = needsChest ? ['chest'] : needsShoulders ? shoulders : [];
    if (
      required.length &&
      candidates.some((e) => primary(data, e.id).some((m) => required.includes(m)))
    )
      candidates = candidates.filter((e) => primary(data, e.id).some((m) => required.includes(m)));
    candidates.sort(
      (a, b) =>
        ctx.score(b, projected, seed) - ctx.score(a, projected, seed) || a.id.localeCompare(b.id),
    );
    const locked = locks[slotKey];
    const e = locked ? candidates.find((e) => e.id === locked.exerciseId) : candidates[0];
    if (!e) break;
    const review = reviewItem(
      data,
      locked ? structuredClone(locked) : makeItem(data, e, slotKey, p, readiness),
      p,
      readiness,
      at,
    );
    if (locked) review.item = structuredClone(locked);
    // A regenerated pairing gets fresh group membership below.
    review.item.groupId = undefined;
    while (result.source.items.some((i) => i.id === review.item.id)) review.item.id += ':added';
    if (!locked && estimateSessionMinutes([...result.source.items, review.item]) > p.timeMinutes)
      continue;
    review.slot = 'accessory';
    review.slotKey = slotKey;
    review.selectionReason = selectionReason(data, e, 'accessory', p, ctx.coverage);
    result.exercises.push(review);
    result.source.items.push(review.item);
    addProjected(data, projected, review.item);
  }
  if (p.allowSupersets) {
    const accessories = result.exercises.filter((e) => e.slot === 'accessory');
    // Group only newly suggested accessories; saved routine grouping remains intact.
    for (let index = 0; index + 1 < accessories.length; index += 2) {
      let id = `suggested-superset:${index}`;
      while (result.source.groups.some((g) => g.id === id)) id += ':added';
      result.source.groups.push({
        id,
        name: `Accessory pair ${index / 2 + 1}`,
        type: 'superset',
        restSeconds: 90,
        betweenSeconds: 15,
        notes: '',
      });
      accessories[index].item.groupId = id;
      accessories[index + 1].item.groupId = id;
    }
  }
}

export function buildFullBodySession(
  data: Data,
  p = defaultSuggestionPreferences,
  readiness: Readiness = 'normal',
  at = Date.now(),
  seed = 0,
  locks: Record<string, Item> = {},
): SessionSuggestion {
  const source = shell(at);
  const result: SessionSuggestion = {
    source,
    choice: { source, key: source.id, kind: 'generated' },
    exercises: [],
    warnings: [],
    blocked: false,
  };
  const ctx = context(data, p, readiness, at);
  result.warnings = [...ctx.warnings];
  const projected = new Map(ctx.coverage);
  for (const slot of ['push', 'pull', 'legs'] as const) {
    let candidates = data.exercises.filter(
      (e) =>
        available(e, p) &&
        ['weighted', 'bodyweight', 'loaded_bodyweight', 'assisted'].includes(e.tracking) &&
        (slot === 'legs'
          ? ['squat', 'hinge'].includes(suggestionRole(e))
          : suggestionRole(e) === slot),
    );
    // The chest preference cannot be accidentally fulfilled by shoulder-only pressing.
    if (slot === 'push' && candidates.some((e) => primary(data, e.id).includes('chest')))
      candidates = candidates.filter((e) => primary(data, e.id).includes('chest'));
    candidates.sort(
      (a, b) =>
        ctx.score(b, projected, seed) - ctx.score(a, projected, seed) || a.id.localeCompare(b.id),
    );
    const locked = locks[slot];
    const e = locked ? candidates.find((e) => e.id === locked.exerciseId) : candidates[0];
    if (!e) {
      result.blocked = true;
      result.warnings!.push(
        `No eligible compound ${slot} movement. Change equipment/exclusions, or set an exercise’s suggested-session role in the library.`,
      );
      continue;
    }
    const review = reviewItem(
      data,
      locked ? structuredClone(locked) : makeItem(data, e, slot, p, readiness),
      p,
      readiness,
      at,
    );
    if (locked) review.item = structuredClone(locked);
    review.slot = slot;
    review.slotKey = slot;
    review.selectionReason = selectionReason(data, e, slot, p, ctx.coverage);
    result.exercises.push(review);
    source.items.push(review.item);
    addProjected(data, projected, review.item);
  }
  if (!result.blocked) {
    if (estimateSessionMinutes(source.items) > p.timeMinutes) {
      // Short sessions retain all three movements, reducing working slots before accessories.
      for (const item of source.items) {
        if (Object.values(locks).some((locked) => locked.id === item.id)) continue;
        let kept = 0;
        item.sets = item.sets.filter((s) => s.label === 'warmup' || kept++ < 2);
      }
    }
    appendAccessories(data, result, p, readiness, at, seed, locks);
    const direct = source.items.flatMap((i) => primary(data, i.exerciseId));
    if (!direct.includes('chest'))
      result.warnings!.push(
        'No direct chest work fits your current equipment, exclusions and accessory/time limits. Review those limits if you want chest work in this full-body session.',
      );
    if (!direct.some((m) => shoulders.includes(m)))
      result.warnings!.push(
        'No direct shoulder accessory fits your current equipment, exclusions and accessory/time limits. Pressing may contribute indirectly; increase an accessory/time limit to include direct shoulder work.',
      );
  }
  finishPreview(result, p);
  return result;
}
function finishPreview(result: SessionSuggestion, p: SuggestionPreferences) {
  result.estimatedMinutes = estimateSessionMinutes(result.source.items);
  if (result.estimatedMinutes > p.timeMinutes)
    result.warnings!.push(
      `Estimated ${result.estimatedMinutes} minutes exceeds your ${p.timeMinutes}-minute target. The session structure is preserved; increase the time target or choose a different session.`,
    );
}
export function improveRoutineSession(
  data: Data,
  choice: SessionChoice,
  p: SuggestionPreferences,
  readiness: Readiness = 'normal',
  at = Date.now(),
) {
  const result = suggestSession(data, choice, at, {
    progression: readiness === 'low_energy' ? 'off' : p.progression,
  });
  result.warnings = context(data, p, readiness, at).warnings;
  if (result.source.benchmark) {
    result.estimatedMinutes = result.source.benchmark.durationSeconds / 60;
    return result;
  }
  for (const item of result.source.items) {
    const e = data.exercises.find((e) => e.id === item.exerciseId);
    if (!e || !available(e, p)) {
      result.blocked = true;
      result.warnings.push(
        `${item.name} does not match your equipment/exclusions or is archived. Your routine is preserved; adjust the preferences or build a full-body session.`,
      );
    }
  }
  if (p.addAccessories && !result.blocked) appendAccessories(data, result, p, readiness, at, 0, {});
  finishPreview(result, p);
  return result;
}

/** Replace one slot only. All other reviewed targets and groups remain byte-for-byte intact. */
export function swapSuggestedExercise(
  data: Data,
  input: SessionSuggestion,
  index: number,
  p: SuggestionPreferences,
  readiness: Readiness = 'normal',
  at = Date.now(),
): SessionSuggestion {
  const current = input.exercises[index];
  if (!current?.slot || input.source.benchmark) return input;
  const used = new Set(input.source.items.map((i) => i.exerciseId));
  const ctx = context(data, p, readiness, at);
  let candidates = data.exercises.filter(
    (e) =>
      available(e, p) &&
      e.tracking !== 'distance' &&
      (current.slot === 'accessory' ||
        ['weighted', 'bodyweight', 'loaded_bodyweight', 'assisted'].includes(e.tracking)) &&
      !used.has(e.id) &&
      (current.slot === 'legs'
        ? ['squat', 'hinge'].includes(suggestionRole(e))
        : current.slot === 'accessory'
          ? suggestionRole(e) === 'accessory'
          : suggestionRole(e) === current.slot),
  );
  if (
    current.slot === 'push' &&
    primary(data, current.item.exerciseId).includes('chest') &&
    (input.choice.kind === 'generated' || p.priorityMuscles.includes('chest'))
  )
    candidates = candidates.filter((e) => primary(data, e.id).includes('chest'));
  if (
    current.slot === 'accessory' &&
    primary(data, current.item.exerciseId).some((m) => shoulders.includes(m)) &&
    (input.choice.kind === 'generated' || p.priorityMuscles.some((m) => shoulders.includes(m)))
  )
    candidates = candidates.filter((e) => primary(data, e.id).some((m) => shoulders.includes(m)));
  candidates.sort(
    (a, b) => ctx.score(b, ctx.coverage) - ctx.score(a, ctx.coverage) || a.id.localeCompare(b.id),
  );
  for (const e of candidates) {
    const result = structuredClone(input);
    const review: ExerciseSuggestion = {
      ...reviewItem(data, makeItem(data, e, current.slotKey!, p, readiness), p, readiness, at),
      slot: current.slot,
      slotKey: current.slotKey,
      selectionReason: selectionReason(data, e, current.slot, p, ctx.coverage),
    };
    review.item.groupId = current.item.groupId;
    result.source.items[index] = review.item;
    result.exercises[index] = review;
    result.estimatedMinutes = estimateSessionMinutes(result.source.items);
    if (
      result.estimatedMinutes <= p.timeMinutes ||
      result.estimatedMinutes <= (input.estimatedMinutes ?? 0)
    )
      return result;
  }
  return {
    ...input,
    warnings: [
      ...(input.warnings ?? []),
      `No alternative for ${current.item.name} fits this slot and your current preferences.`,
    ],
  };
}

export function buildCindySession(
  data: Data,
  p: SuggestionPreferences,
  at = Date.now(),
): SessionSuggestion {
  const starter = catalogue();
  const source = shell(at);
  source.id = 'suggested-cindy';
  source.name = 'Cindy';
  source.benchmark = {
    kind: 'cindy',
    variant: 'standard',
    durationSeconds: 1200,
    reps: [5, 10, 15],
    rounds: 0,
    extraReps: 0,
    elapsedSeconds: 0,
  };
  const warnings: string[] = [];
  for (const [index, name] of ['Pull-up', 'Push-up', 'Air squat'].entries()) {
    const existing = data.exercises.find(
      (e) => e.name.toLowerCase() === name.toLowerCase() && e.tracking === 'bodyweight',
    );
    const exercise = existing ?? starter.exercises.find((e) => e.name === name)!;
    if (!available(exercise, p))
      warnings.push(
        `${name} is unavailable with your equipment/exclusions. Change those preferences before starting standard Cindy.`,
      );
    const item = makeItem(data, exercise, `cindy:${index}`, p, 'normal');
    item.repMin = item.repMax = source.benchmark.reps[index];
    item.restSeconds = 0;
    item.sets = [{ label: 'working', reps: item.repMin }];
    source.items.push(item);
  }
  return {
    source,
    choice: { key: source.id, source, kind: 'benchmark' },
    exercises: source.items.map((item) => ({
      item,
      previous: [],
      change: 'unchanged',
      reason: 'Fixed benchmark sequence; no automatic load or rep increases.',
    })),
    warnings,
    blocked: warnings.length > 0,
    estimatedMinutes: 20,
  };
}
