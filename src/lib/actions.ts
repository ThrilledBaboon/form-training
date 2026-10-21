import { precedesSession } from './session-continuity';
import { defaultWorkspace, SetupSnapshotSchema } from './workspace-model';
import { db, type TrainingDB } from './db';
import {
  uid,
  now,
  ExerciseSchema,
  MappingSchema,
  RoutineSchema,
  SessionSchema,
  SetSchema,
  BodyweightSchema,
  SettingsSchema,
  PlanSchema,
  defaults,
  type Exercise,
  type Mapping,
  type Routine,
  type Session,
  type WorkoutSet,
  type Item,
  type Plan,
  type Settings,
} from './model';
import { exerciseHistory, recommendation, toKg } from './calc';
import { readData } from './db';
import { catalogue } from './catalogue';
import { weightTags } from './weight-tags';
import type { SessionSuggestion } from './suggestions';
import type { Benchmark } from './suggestion-preferences';
export async function resetAllData(database = db) {
  const starter = catalogue();
  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) await table.clear();
    await database.exercises.bulkAdd(starter.exercises);
    await database.mappings.bulkAdd(starter.mappings);
    await database.routines.bulkAdd(starter.routines);
    await database.settings.put({ ...defaults });
    await database.workspaces.put(defaultWorkspace());
  });
}
export async function saveExercise(exercise: Exercise, mappings: Mapping[], database = db) {
  ExerciseSchema.parse(exercise);
  if (exercise.repMax < exercise.repMin) throw Error('Maximum reps must be at least the minimum.');
  if (mappings.some((m) => m.exerciseId !== exercise.id))
    throw Error('Muscle mapping belongs to another exercise.');
  mappings.forEach((m) => MappingSchema.parse(m));
  if (new Set(mappings.map((m) => m.muscle)).size !== mappings.length)
    throw Error('Assign each muscle only once.');
  await database.transaction('rw', [database.exercises, database.mappings], async () => {
    await database.exercises.put(exercise);
    await database.mappings.where('exerciseId').equals(exercise.id).delete();
    await database.mappings.bulkPut(mappings);
  });
}
export async function saveSettings(patch: Partial<Settings>, database = db) {
  await database.transaction('rw', database.settings, async () => {
    const old = await database.settings.get('preferences');
    await database.settings.put(SettingsSchema.parse({ ...old, ...patch, id: 'preferences' }));
  });
}
export async function saveRoutine(r: Routine, database = db) {
  RoutineSchema.parse(r);
  if (new Set(r.items.map((i) => i.id)).size !== r.items.length)
    throw Error('Duplicate exercise items.');
  if (r.items.some((i) => i.groupId && !r.groups.some((g) => g.id === i.groupId)))
    throw Error('Unknown exercise group.');
  await database.routines.put({ ...r, updatedAt: now() });
}
export function exerciseItem(e: Exercise): Item {
  return {
    id: uid(),
    exerciseId: e.id,
    name: e.name,
    tracking: e.tracking,
    includeBodyweight: e.includeBodyweight,
    notes: '',
    sets: Array.from({ length: e.defaultSets }, () =>
      e.tracking === 'duration'
        ? { durationSeconds: 45, label: 'working' as const }
        : e.tracking === 'distance'
          ? { distanceM: 1000, durationSeconds: 300, label: 'working' as const }
          : { reps: e.repMin, label: 'working' as const },
    ),
    repMin: e.repMin,
    repMax: e.repMax,
    restSeconds: e.restSeconds,
  };
}
export async function startSession(
  source?: Routine | Plan,
  database: TrainingDB = db,
  options: { prefillHistory?: boolean; linkSource?: boolean } = {},
): Promise<string> {
  const data = await readData(database);
  const t = now();
  const sessionId = uid();
  const items: Item[] = (source?.items || []).map((i) => {
    const profile = data.workspace?.setups.find(
      (s) => s.exerciseId === i.exerciseId && s.isDefault && !s.archived,
    );
    return {
      ...i,
      id: uid(),
      setup: i.setup ?? (profile ? SetupSnapshotSchema.parse(profile) : undefined),
    };
  });
  const settings = data.settings;
  const bodyweight = [...data.bodyweights]
    .filter((b) => b.at <= t)
    .sort((a, b) => b.at.localeCompare(a.at))[0]?.kg;
  const sets: WorkoutSet[] = source?.benchmark
    ? []
    : items.flatMap((item) => {
        const previous =
          options.prefillHistory === false
            ? undefined
            : exerciseHistory(
                {
                  ...data,
                  sets: data.sets.filter(
                    (s) =>
                      (s.setup?.id ?? '') === (item.setup?.id ?? '') &&
                      (s.setup?.basis ?? 'unspecified') === (item.setup?.basis ?? 'unspecified'),
                  ),
                },
                item.exerciseId,
                item.tracking,
              )[0]?.sets.at(-1);
        return item.sets.map((p, order) => ({
          id: uid(),
          sessionId,
          itemId: item.id,
          exerciseId: item.exerciseId,
          setup: item.setup,
          order,
          ...p,
          loadKg: p.loadKg ?? previous?.loadKg ?? 0,
          bodyweightKg: item.includeBodyweight ? bodyweight : undefined,
          restSeconds: p.restSeconds ?? item.restSeconds ?? settings.defaultRest,
          label: p.label || 'working',
          completed: false,
          notes: p.notes ?? '',
          restUnknown: p.restSeconds === undefined && item.restUnknown,
        }));
      });
  const session: Session = {
    id: sessionId,
    name: source?.name || 'Freestyle workout',
    startAt: t,
    status: 'active',
    benchmark: source?.benchmark
      ? {
          ...structuredClone(source.benchmark),
          rounds: 0,
          extraReps: 0,
          elapsedSeconds: 0,
          timerStartedAt: undefined,
        }
      : undefined,
    routineId:
      options.linkSource === false
        ? undefined
        : source && 'weekdays' in source
          ? source.id
          : source && 'routineId' in source
            ? source.routineId
            : undefined,
    planId: options.linkSource !== false && source && 'date' in source ? source.id : undefined,
    items,
    groups: source?.groups || [],
    notes: source && 'notes' in source ? source.notes : '',
    updatedAt: t,
  };
  await database.transaction('rw', [database.sessions, database.sets, database.plans], async () => {
    const active = await database.sessions.where('status').equals('active').first();
    if (active) throw Error('Resume or finish your active workout first.');
    SessionSchema.parse(session);
    await database.sessions.add(session);
    if (sets.length) await database.sets.bulkAdd(sets);
    if (options.linkSource !== false && source && 'date' in source)
      await database.plans.update(source.id, { status: 'started' });
  });
  return sessionId;
}
export async function startSuggestedSession(suggestion: SessionSuggestion, database = db) {
  if (suggestion.blocked)
    throw Error('Resolve the missing movements or constraints before starting.');
  return database.transaction('rw', database.tables, async () => {
    for (const item of suggestion.source.items) {
      const exercise = await database.exercises.get(item.exerciseId);
      if (
        (exercise && (exercise.archived || exercise.tracking !== item.tracking)) ||
        (!exercise && suggestion.choice.kind !== 'benchmark')
      )
        throw Error(`${item.name} changed in your library. Generate a fresh preview.`);
    }
    // The built-in circuit adds its missing starter movements only when the preview is accepted.
    if (suggestion.choice.kind === 'benchmark') {
      const starter = catalogue();
      for (const item of suggestion.source.items) {
        const existing = await database.exercises.get(item.exerciseId);
        if (existing?.archived)
          throw Error(`${item.name} is archived. Review your exercise library.`);
        if (!existing) {
          const exercise = starter.exercises.find((e) => e.id === item.exerciseId);
          if (!exercise) throw Error('A benchmark exercise is missing. Generate a new preview.');
          await database.exercises.add(exercise);
          await database.mappings.bulkAdd(
            starter.mappings.filter((m) => m.exerciseId === exercise.id),
          );
        }
      }
    }
    return startSession(suggestion.source, database, {
      prefillHistory: false,
      linkSource: !['generated', 'benchmark'].includes(suggestion.choice.kind),
    });
  });
}
export async function addExercise(sessionId: string, exercise: Exercise, database = db) {
  return insertExercise(sessionId, exercise, database);
}
export async function substituteExercise(
  sessionId: string,
  itemId: string,
  exercise: Exercise,
  database = db,
) {
  return insertExercise(sessionId, exercise, database, itemId);
}
async function insertExercise(
  sessionId: string,
  exercise: Exercise,
  database: TrainingDB,
  replaceItemId?: string,
) {
  const data = await readData(database);
  const profile = data.workspace?.setups.find(
    (s) => s.exerciseId === exercise.id && s.isDefault && !s.archived,
  );
  const setup = profile ? SetupSnapshotSchema.parse(profile) : undefined;
  const previous = exerciseHistory(
    {
      ...data,
      sets: data.sets.filter(
        (s) =>
          (s.setup?.id ?? '') === (setup?.id ?? '') &&
          (s.setup?.basis ?? 'unspecified') === (setup?.basis ?? 'unspecified'),
      ),
    },
    exercise.id,
    exercise.tracking,
  )[0]?.sets.at(-1);
  const bw = [...data.bodyweights]
    .filter((b) => b.at <= now())
    .sort((a, b) => b.at.localeCompare(a.at))[0]?.kg;
  await database.transaction('rw', [database.sessions, database.sets], async () => {
    const s = await database.sessions.get(sessionId);
    if (!s) throw Error('Workout not found.');
    const item = { ...exerciseItem(exercise), setup };
    const index = replaceItemId ? s.items.findIndex((i) => i.id === replaceItemId) : -1;
    if (replaceItemId) {
      if (index < 0) throw Error('Exercise no longer exists in this workout.');
      const oldSets = await database.sets.where('itemId').equals(replaceItemId).toArray();
      if (oldSets.some((set) => set.completed))
        throw Error(
          'Completed sets belong to this exercise. Add a new exercise to preserve their history.',
        );
      item.groupId = s.items[index].groupId;
      await database.sets.where('itemId').equals(replaceItemId).delete();
    }
    const sets: WorkoutSet[] = item.sets.map((p, order) => ({
      id: uid(),
      sessionId,
      itemId: item.id,
      exerciseId: exercise.id,
      setup,
      order,
      ...p,
      loadKg: p.loadKg ?? previous?.loadKg ?? 0,
      bodyweightKg: item.includeBodyweight ? bw : undefined,
      restSeconds: item.restSeconds,
      label: p.label,
      completed: false,
      notes: '',
    }));
    const items = [...s.items];
    if (index >= 0) items[index] = item;
    else items.push(item);
    await database.sessions.put(SessionSchema.parse({ ...s, items, updatedAt: now() }));
    await database.sets.bulkAdd(sets);
  });
}
export async function updateSession(id: string, patch: Partial<Session>, database = db) {
  await database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(id);
    if (!s) throw Error('Workout not found.');
    await database.sessions.put(SessionSchema.parse({ ...s, ...patch, id, updatedAt: now() }));
  });
}
export async function updateBenchmark(
  id: string,
  patch: Partial<Benchmark> | ((value: Benchmark) => Partial<Benchmark>),
  database = db,
) {
  await database.transaction('rw', database.sessions, async () => {
    const session = await database.sessions.get(id);
    if (!session?.benchmark) throw Error('Circuit no longer exists.');
    const changes = typeof patch === 'function' ? patch(session.benchmark) : patch;
    await database.sessions.put(
      SessionSchema.parse({
        ...session,
        benchmark: { ...session.benchmark, ...changes },
        updatedAt: now(),
      }),
    );
  });
}
export async function updateSet(id: string, patch: Partial<WorkoutSet>, database = db) {
  await database.transaction('rw', [database.sets, database.sessions], async () => {
    const old = await database.sets.get(id);
    if (!old) throw Error('Set no longer exists.');
    const next = SetSchema.parse({ ...old, ...patch, id });
    if (next.rpe !== undefined && next.rir !== undefined)
      throw Error('Use RPE or RIR for a set, not both.');
    if (next.completed) {
      const session = await database.sessions.get(next.sessionId);
      const item = session?.items.find((i) => i.id === next.itemId);
      if (!item) throw Error('Workout exercise not found.');
      validateCompletion(next, item);
    }
    await database.sets.put(next);
  });
}
export function validateCompletion(s: WorkoutSet, item: Item) {
  if (
    ['weighted', 'bodyweight', 'loaded_bodyweight', 'assisted'].includes(item.tracking) &&
    !(s.reps && s.reps > 0)
  )
    throw Error('Enter repetitions before completing this set.');
  if (item.tracking === 'weighted' && !(s.loadKg && s.loadKg > 0))
    throw Error('Enter a load above zero. For unweighted work, use a bodyweight exercise.');
  if (item.tracking === 'duration' && !(s.durationSeconds && s.durationSeconds > 0))
    throw Error('Enter a duration above zero.');
  if (item.tracking === 'distance' && !(s.distanceM && s.distanceM > 0))
    throw Error('Enter a distance above zero.');
  if (
    item.includeBodyweight &&
    ['bodyweight', 'loaded_bodyweight', 'assisted'].includes(item.tracking) &&
    !s.bodyweightKg
  )
    throw Error(
      'Enter the bodyweight for this set or turn off bodyweight-inclusive calculations in the exercise settings.',
    );
  if (
    item.tracking === 'assisted' &&
    item.includeBodyweight &&
    (s.loadKg || 0) >= (s.bodyweightKg || 0)
  )
    throw Error('Assistance must be below the recorded bodyweight.');
}
export async function completeSet(id: string, database = db) {
  await database.transaction(
    'rw',
    [database.sessions, database.sets, database.timers],
    async () => {
      const s = await database.sets.get(id);
      if (!s) throw Error('Set not found.');
      if (s.completed) return;
      const session = await database.sessions.get(s.sessionId);
      const item = session?.items.find((i) => i.id === s.itemId);
      if (!item) throw Error('Exercise not found.');
      validateCompletion(s, item);
      await database.sets.update(id, {
        completed: true,
        completedAt: now(),
        setup: s.setup ?? item.setup,
      });
      if (session?.status === 'active' && !s.restUnknown) {
        const group = session.groups.find((g) => g.id === (s.groupId || item.groupId));
        let rest = s.restSeconds;
        if (group) {
          const allSets = await database.sets.where('sessionId').equals(session.id).toArray();
          if (group.type === 'dropset') {
            rest = allSets.some(
              (other) =>
                other.itemId === item.id &&
                other.order > s.order &&
                (other.groupId || item.groupId) === group.id,
            )
              ? (group.betweenSeconds ?? 0)
              : group.restSeconds;
          } else {
            const groupItems = session.items.filter(
              (i) =>
                i.groupId === group.id ||
                allSets.some((other) => other.itemId === i.id && other.groupId === group.id),
            );
            const position = groupItems.findIndex((i) => i.id === item.id);
            rest =
              position === groupItems.length - 1 ? group.restSeconds : (group.betweenSeconds ?? 0);
          }
        }
        await database.timers.put({
          id: 'rest',
          endAt: Date.now() + rest * 1000,
          durationMs: rest * 1000,
          exerciseName: item.name,
          notified: false,
        });
      }
    },
  );
}
export async function duplicateSet(set: WorkoutSet, database = db) {
  const next = { ...set, id: uid(), completed: false, completedAt: undefined };
  await database.transaction('rw', database.sets, async () => {
    const max = await database.sets.where('itemId').equals(set.itemId).toArray();
    next.order = Math.max(-1, ...max.map((s) => s.order)) + 1;
    await database.sets.add(next);
  });
}
export async function finishSession(id: string, database = db) {
  await database.transaction(
    'rw',
    [database.sessions, database.sets, database.timers],
    async () => {
      const s = await database.sessions.get(id);
      if (!s) throw Error('Workout not found.');
      const sets = await database.sets.where('sessionId').equals(id).toArray();
      if (
        !sets.some((x) => x.completed) &&
        !(s.benchmark && (s.benchmark.rounds > 0 || s.benchmark.extraReps > 0))
      )
        throw Error(
          s.benchmark
            ? 'Log a completed round or additional reps to finish, or cancel the circuit.'
            : 'Complete at least one set to finish, or cancel the session.',
        );
      const t = now();
      const benchmark = s.benchmark
        ? {
            ...s.benchmark,
            elapsedSeconds:
              s.benchmark.elapsedSeconds +
              (s.benchmark.timerStartedAt
                ? Math.max(0, (Date.parse(t) - Date.parse(s.benchmark.timerStartedAt)) / 1000)
                : 0),
            timerStartedAt: undefined,
          }
        : undefined;
      await database.sessions.put(
        SessionSchema.parse({ ...s, benchmark, status: 'completed', endAt: t, updatedAt: t }),
      );
      await database.timers.delete('rest');
    },
  );
}
export async function deleteSession(id: string, database = db) {
  const snapshot = await database.transaction(
    'rw',
    [database.sessions, database.sets, database.timers, database.plans],
    async () => {
      const session = await database.sessions.get(id);
      const sets = await database.sets.where('sessionId').equals(id).toArray();
      const timer = session?.status === 'active' ? await database.timers.get('rest') : undefined;
      const plan = session?.planId ? await database.plans.get(session.planId) : undefined;
      await database.sets.where('sessionId').equals(id).delete();
      await database.sessions.delete(id);
      if (session?.status === 'active') await database.timers.delete('rest');
      if (
        session?.planId &&
        !(await database.sessions.filter((s) => s.planId === session.planId).count())
      )
        await database.plans.update(session.planId, { status: 'planned' });
      return { session, sets, timer, plan };
    },
  );
  return async () => {
    const { session, sets, timer, plan } = snapshot;
    if (session)
      await database.transaction(
        'rw',
        [database.sessions, database.sets, database.plans, database.timers],
        async () => {
          if (
            session.status === 'active' &&
            (await database.sessions.where('status').equals('active').count())
          )
            throw Error('Finish the current workout before restoring another active one.');
          await database.sessions.put(session);
          await database.sets.bulkPut(sets);
          if (timer) await database.timers.put(timer);
          if (plan && (await database.plans.get(plan.id))?.status === 'planned')
            await database.plans.update(plan.id, { status: plan.status });
        },
      );
  };
}
export async function applySuggestedTargets(sessionId: string, itemId: string, database = db) {
  const data = await readData(database);
  const item = data.sessions.find((s) => s.id === sessionId)?.items.find((i) => i.id === itemId);
  if (!item || ['duration', 'distance'].includes(item.tracking))
    throw Error('Choose repetition targets for this exercise.');
  const current = data.sessions.find((s) => s.id === sessionId)!;
  const target = recommendation(
    { ...data, sessions: data.sessions.filter((s) => precedesSession(s, current)) },
    item,
  );
  await database.transaction('rw', [database.sessions, database.sets], async () => {
    if ((await database.sessions.get(sessionId))?.status !== 'active')
      throw Error('Resume an active workout to apply targets.');
    const pending = (await database.sets.where('sessionId').equals(sessionId).toArray()).filter(
      (s) => s.itemId === itemId && !s.completed && s.label !== 'warmup',
    );
    for (const set of pending) {
      await database.sets.put(
        SetSchema.parse({
          ...set,
          reps: target.reps,
          loadKg: item.tracking === 'bodyweight' ? set.loadKg : target.loadKg,
          restSeconds: target.rest,
        }),
      );
    }
  });
}
export async function savePlan(plan: Plan, database = db) {
  PlanSchema.parse(plan);
  await database.plans.put(plan);
}
export async function saveBodyweight(
  entry: { id: string; at: string; kg: number; notes: string; tags?: string[] },
  database = db,
) {
  await database.bodyweights.put(
    BodyweightSchema.parse({ ...entry, ...(entry.tags ? { tags: weightTags(entry.tags) } : {}) }),
  );
}
export async function changeTimer(action: 'toggle' | 'reset' | 'add' | 'subtract', database = db) {
  await database.transaction('rw', database.timers, async () => {
    const t = await database.timers.get('rest');
    if (!t) return;
    const at = Date.now();
    const remaining = t.endAt === undefined ? t.pausedMs || 0 : Math.max(0, t.endAt - at);
    const patch =
      action === 'toggle'
        ? t.endAt === undefined
          ? { endAt: at + remaining, pausedMs: undefined, notified: false }
          : { endAt: undefined, pausedMs: remaining }
        : action === 'reset'
          ? { endAt: at + t.durationMs, pausedMs: undefined, notified: false }
          : t.endAt === undefined
            ? {
                pausedMs: Math.max(0, remaining + (action === 'add' ? 15000 : -15000)),
                notified: false,
              }
            : {
                endAt: at + Math.max(0, remaining + (action === 'add' ? 15000 : -15000)),
                notified: false,
              };
    await database.timers.update('rest', patch);
  });
}
export async function reorderRoutines(id: string, offset: number, database = db) {
  await database.transaction('rw', database.routines, async () => {
    const routines = (await database.routines.toArray()).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.localeCompare(b.createdAt),
    );
    const index = routines.findIndex((r) => r.id === id);
    const next = index + offset;
    if (index < 0 || next < 0 || next >= routines.length) return;
    [routines[index], routines[next]] = [routines[next], routines[index]];
    await database.routines.bulkPut(routines.map((r, sortOrder) => ({ ...r, sortOrder })));
  });
}
export async function updateSessionItem(
  sessionId: string,
  itemId: string,
  patch: Partial<Item>,
  database = db,
) {
  await database.transaction('rw', database.sessions, async () => {
    const session = await database.sessions.get(sessionId);
    if (!session || !session.items.some((i) => i.id === itemId))
      throw Error('Workout exercise not found.');
    await database.sessions.put(
      SessionSchema.parse({
        ...session,
        items: session.items.map((i) =>
          i.id === itemId ? { ...i, ...patch, id: i.id, exerciseId: i.exerciseId } : i,
        ),
        updatedAt: now(),
      }),
    );
  });
}
