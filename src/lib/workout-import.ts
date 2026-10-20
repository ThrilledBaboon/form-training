import { z } from 'zod';
import { db } from './db';
import {
  ExerciseSchema,
  SessionSchema,
  SetSchema,
  RoutineSchema,
  trackingTypes,
  now,
  uid,
  type Data,
  type Exercise,
  type Item,
  type WorkoutSet,
} from './model';
import {
  defaultWorkspace,
  LoadBasisSchema,
  SetupSnapshotSchema,
  WorkspaceSchema,
} from './workspace-model';
import { validateCompletion } from './actions';
import { contentKey } from './layout-sharing';
import { toKg } from './calc';
import { prepareWorkoutNotes, type NoteRules } from './note-rules';

const optionalNumber = z.number().finite().nonnegative().max(1e6).optional();
export const ImportSetSchema = z.object({
  reps: optionalNumber,
  loadKg: optionalNumber,
  durationSeconds: optionalNumber,
  distanceM: optionalNumber,
  partialReps: optionalNumber,
  restSeconds: optionalNumber,
  notes: z.string().max(10000).default(''),
  label: z.enum(['working', 'warmup', 'failure', 'PR', 'custom']).default('working'),
  completed: z.boolean().default(true),
});
export const ImportItemSchema = z.object({
  name: z.string().min(1).max(150),
  exerciseId: z.string().optional(),
  create: z.boolean().default(false),
  tracking: z.enum(trackingTypes).default('weighted'),
  basis: LoadBasisSchema.default('unspecified'),
  setupId: z.string().optional(),
  notes: z.string().max(10000).default(''),
  sets: z.array(ImportSetSchema).max(100),
});
export const ImportSessionSchema = z.object({
  name: z.string().min(1).max(150),
  date: z.string().max(10).default(''),
  dateOnly: z.boolean().default(true),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  notes: z.string().max(10000).default(''),
  selected: z.boolean().default(true),
  accepted: z.boolean().default(false),
  warnings: z.array(z.string().max(500)).max(200).default([]),
  items: z.array(ImportItemSchema).max(100),
});
export const WorkoutDraftSchema = z.object({
  id: z.string().min(1),
  source: z.string().max(100000),
  sourceEdited: z.boolean().default(false),
  sessions: z.array(ImportSessionSchema).max(50),
});
export type WorkoutDraft = z.infer<typeof WorkoutDraftSchema>;
export type ImportItem = z.infer<typeof ImportItemSchema>;
export type ImportSet = z.infer<typeof ImportSetSchema>;
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function measurements(line: string): Partial<ImportSet> {
  const n = (s: string) => Number(s.replace(',', '.'));
  const load = line.match(/(\d+(?:[.,]\d+)?)\s*(kg|lbs?)\b/i);
  const reps =
    line.match(/(\d+(?:\.\d+)?)\s*reps?\b/i) ??
    line.match(/\b\d+\s*[x×]\s*(\d+)\b/i) ??
    line.match(/(?:kg|lbs?)\s*[x×]\s*(\d+)/i);
  const rest =
    line.match(/(\d+(?:[.,]\d+)?)\s*(minutes?|mins?|seconds?|secs?|s)\s*rest/i) ??
    line.match(/rest\s*:?\s*(\d+(?:[.,]\d+)?)\s*(minutes?|mins?|seconds?|secs?|s)/i);
  const duration = line.match(
    /(?:duration|hold|time)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(minutes?|mins?|seconds?|secs?|s)\b/i,
  );
  const distance = line.match(/(\d+(?:[.,]\d+)?)\s*(km|metres?|meters?|m)\b/i);
  return {
    ...(load ? { loadKg: toKg(n(load[1]), load[2].toLowerCase() === 'kg' ? 'kg' : 'lb') } : {}),
    ...(reps ? { reps: n(reps[1]) } : {}),
    ...(rest ? { restSeconds: n(rest[1]) * (rest[2].toLowerCase().startsWith('m') ? 60 : 1) } : {}),
    ...(duration
      ? { durationSeconds: n(duration[1]) * (duration[2].toLowerCase().startsWith('m') ? 60 : 1) }
      : {}),
    ...(distance
      ? { distanceM: n(distance[1]) * (distance[2].toLowerCase() === 'km' ? 1000 : 1) }
      : {}),
  };
}
export function parseWorkoutNotes(source: string, data: Data, rules?: NoteRules): WorkoutDraft {
  if (source.length > 100000) throw Error('Paste up to 100,000 characters at a time.');
  if (!source.trim()) throw Error('Paste workout notes first.');
  const sessions: WorkoutDraft['sessions'] = [];
  let current: WorkoutDraft['sessions'][number] | undefined,
    item: ImportItem | undefined,
    base: Partial<ImportSet> = {},
    automatic = false;
  const session = () => {
    if (!current) {
      current = ImportSessionSchema.parse({
        name: 'Imported workout',
        date: '',
        items: [],
        warnings: ['Review the date, all measurements and unknown fields.'],
      });
      sessions.push(current);
    }
    return current;
  };
  const finishItem = () => {
    if (item && !item.sets.length) {
      item.sets = [ImportSetSchema.parse(base)];
      session().warnings.push(
        'No explicit set count for ' + item.name + '; review the proposed single set.',
      );
    }
  };
  const lines = prepareWorkoutNotes(source, rules)
    .replace(/&#x20;|&nbsp;/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\*\*/g, '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const raw of lines) {
    let line = raw.replace(/^[-•]\s*/, '');
    const date = line.match(
      /^(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4}))\b/,
    );
    if (date) {
      finishItem();
      const dateText = date[1]
        ? `${date[1]}-${date[2]}-${date[3]}`
        : `${date[6].length === 2 ? '20' + date[6] : date[6]}-${date[5].padStart(2, '0')}-${date[4].padStart(2, '0')}`;
      current = ImportSessionSchema.parse({
        name: 'Workout · ' + dateText,
        date: dateText,
        items: [],
        warnings: ['Review the date, all measurements, unknown fields and load conventions.'],
      });
      sessions.push(current);
      item = undefined;
      base = {};
      line = line.slice(date[0].length).trim();
      if (!line) continue;
    }
    if (/^(compounds?|isolation|exercises?|workout|\[\d.*\])\s*:?(?:\s*)$/i.test(line)) continue;
    const marker = line.match(/^(\d{1,2})[.)]\s*(.*)$/);
    if (marker && item) {
      if (automatic) {
        item.sets = [];
        automatic = false;
      }
      const index = +marker[1] - 1;
      if (index < 0 || index >= 100) throw Error('Set numbers must be between 1 and 100.');
      const rest = marker[2].replace(new RegExp('^' + marker[1] + '(?:\\s+|$)'), '').trim();
      const overrides = measurements(rest);
      const notes = rest
        .replace(
          /\d+(?:[.,]\d+)?\s*(?:kg|lbs?|reps?|minutes?\s*rest|mins?\s*rest|seconds?\s*rest)/gi,
          '',
        )
        .replace(/\b(instead|rest)\b/gi, '')
        .trim();
      while (item.sets.length <= index) item.sets.push(ImportSetSchema.parse(base));
      item.sets[index] = ImportSetSchema.parse({ ...base, ...overrides, notes });
      continue;
    }
    if (/^(?:notes?|reminder)\s*:/i.test(line)) {
      const note = line.replace(/^(?:notes?|reminder)\s*:\s*/i, '');
      if (item) {
        item.notes += (item.notes ? '\n' : '') + note;
        const partial =
          note.match(
            /last\s+(\d+)\s+reps?.*?(\d+)(?:st|nd|rd|th)\s+set.*?(?:partial|didn.t count)/i,
          ) ?? note.match(/last\s+(\d+)\s+reps?.*?(\d+)(?:st|nd|rd|th)\s+set/i);
        if (partial && /partial|didn.t count/i.test(note)) {
          const set = item.sets[+partial[2] - 1];
          if (set?.reps !== undefined) {
            set.partialReps = +partial[1];
            set.reps = Math.max(0, set.reps - set.partialReps);
            set.notes += (set.notes ? '\n' : '') + note;
            session().warnings.push(
              'Partial reps were separated for ' + item.name + '; confirm this interpretation.',
            );
          }
        }
      } else session().notes += (session().notes ? '\n' : '') + note;
      continue;
    }
    const values = measurements(line);
    if (item && (/^[\d(]/.test(line) || /^rest\s*:/i.test(line)) && Object.keys(values).length) {
      base = { ...base, ...values };
      const count = line.match(/^(\d+)\s*[x×]\s*\d+/i);
      if (count) {
        if (+count[1] > 100) throw Error('Use up to 100 sets per exercise.');
        item.sets = Array.from({ length: +count[1] }, () => ImportSetSchema.parse(base));
        automatic = true;
      }
      if (automatic) item.sets = item.sets.map((s) => ({ ...s, ...values }));
      continue;
    }
    const candidateName = line
      .replace(/\([^)]*\)/g, '')
      .split(/\d|\b(?:rest|reps?)\b/i)[0]
      .replace(/\b(?:Exercises|Compounds|Isolation)\b/gi, '')
      .trim()
      .replace(/[,:;-]+$/, '')
      .trim();
    if (!candidateName) {
      session().notes += (session().notes ? '\n' : '') + raw;
      continue;
    }
    const key = normal(candidateName);
    const matches = data.exercises.filter((e) =>
      [e.name, ...e.aliases].some((alias) => normal(alias) === key),
    );
    const fuzzy = matches.length
      ? matches
      : data.exercises.filter((e) => normal(e.name).endsWith(key));
    if (
      /\b(?:could|felt|maybe|remember|swim|pool|hardest|struggling)\b/i.test(candidateName) &&
      !fuzzy.length
    ) {
      if (item) item.notes += (item.notes ? '\n' : '') + raw;
      else session().notes += (session().notes ? '\n' : '') + raw;
      continue;
    }
    finishItem();
    const matched = fuzzy.length === 1 ? fuzzy[0] : undefined;
    item = ImportItemSchema.parse({
      name: matched?.name ?? candidateName,
      exerciseId: matched?.id,
      tracking: matched?.tracking ?? 'weighted',
      basis: /per\s*(?:dumbbell|hand)/i.test(line)
        ? 'per_dumbbell'
        : /per\s*side/i.test(line)
          ? 'per_side'
          : 'unspecified',
      sets: [],
    });
    session().items.push(item);
    base = values;
    automatic = false;
    if (!matched) session().warnings.push('Match or explicitly create exercise: ' + candidateName);
    const sets = line.match(/\b(\d+)\s*[x×]\s*\d+\b/i) ?? line.match(/\b(\d+)\s*sets?\b/i);
    if (sets) {
      const count = +sets[1];
      if (count < 1 || count > 100) throw Error('Use 1–100 sets per exercise.');
      item.sets = Array.from({ length: count }, () => ImportSetSchema.parse(base));
      automatic = true;
    }
  }
  finishItem();
  return WorkoutDraftSchema.parse({ id: uid(), source, sessions });
}
export async function saveWorkoutImport(
  draft: WorkoutDraft,
  mode: 'history' | 'routines' | 'both',
  allowDuplicate = false,
  database = db,
) {
  const valid = WorkoutDraftSchema.parse(draft);
  if (valid.sourceEdited) throw Error('Parse the changed source before saving.');
  const selected = valid.sessions.filter((s) => s.selected);
  if (!selected.length) throw Error('Select at least one workout.');
  if (selected.some((s) => !s.accepted))
    throw Error('Review and confirm each selected workout first.');
  const workoutKeys = await Promise.all(selected.map(reviewedWorkoutKey));
  const fingerprint = await contentKey(JSON.stringify(workoutKeys));
  const importId = valid.id + (allowDuplicate ? ':' + uid() : '');
  return database.transaction('rw', database.tables, async () => {
    const workspace = (await database.workspaces.get('workspace')) ?? defaultWorkspace();
    if (workspace.imports.some((i) => i.id === importId))
      throw Error('This reviewed draft was already saved. It will not be saved twice.');
    if (
      !allowDuplicate &&
      workspace.imports.some(
        (i) =>
          (i.fingerprint === fingerprint ||
            i.workoutKeys?.some((key) => workoutKeys.includes(key))) &&
          ((mode !== 'routines' && i.sessionIds.length) ||
            (mode !== 'history' && i.routineIds.length)),
      )
    )
      throw Error(
        'This reviewed workout was already imported. Choose an explicit additional copy if intended.',
      );
    const exercises = await database.exercises.toArray();
    const sessionIds: string[] = [],
      routineIds: string[] = [];
    for (const imported of selected) {
      const date = new Date((imported.date || dateKeyLocal(new Date())) + 'T12:00:00');
      if (
        (mode !== 'routines' || imported.date !== '') &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(imported.date) ||
          isNaN(date.getTime()) ||
          dateKeyLocal(date) !== imported.date)
      )
        throw Error('Enter a valid workout date.');
      if (imported.dateOnly) date.setHours(0, 0, 0, 0);
      if (!imported.items.length) throw Error('Each selected workout needs at least one exercise.');
      const items: Item[] = [],
        sets: WorkoutSet[] = [];
      const sessionId = uid();
      for (const input of imported.items) {
        let exercise = exercises.find((e) => e.id === input.exerciseId);
        if (!exercise && input.create) {
          exercise = exercises.find(
            (e) =>
              e.name.toLowerCase() === input.name.toLowerCase() && e.tracking === input.tracking,
          );
          if (!exercise) {
            exercise = ExerciseSchema.parse({
              id: uid(),
              name: input.name,
              aliases: [],
              equipment: 'Unspecified',
              category: 'Custom',
              movement: 'Unspecified',
              unilateral: false,
              tracking: input.tracking,
              restSeconds: 0,
              repMin: 0,
              repMax: 0,
              defaultSets: Math.max(1, input.sets.length),
              notes: 'Imported definition; configure muscles and defaults as needed.',
              tags: [],
              archived: false,
              includeBodyweight: false,
              createdAt: now(),
              updatedAt: now(),
            });
            await database.exercises.add(exercise);
            exercises.push(exercise);
          }
        }
        if (!exercise) throw Error('Match or explicitly create ' + input.name + '.');
        if (mode !== 'history' && exercise.tracking !== input.tracking)
          throw Error('Choose a matching exercise tracking type before creating a routine.');
        if (!input.sets.length) throw Error('Add at least one set for ' + input.name + '.');
        const setup = workspace.setups.find(
          (s) => s.id === input.setupId && !s.archived && s.exerciseId === exercise.id,
        );
        if (input.setupId && !setup)
          throw Error('Equipment setup no longer matches ' + input.name + '.');
        const snapshot = setup
          ? SetupSnapshotSchema.parse(setup)
          : input.basis !== 'unspecified'
            ? SetupSnapshotSchema.parse({
                id: 'basis-' + input.basis,
                name: 'Recorded load convention',
                basis: input.basis,
              })
            : undefined;
        const item: Item = {
          id: uid(),
          exerciseId: exercise.id,
          name: exercise.name,
          tracking: input.tracking,
          includeBodyweight: false,
          notes: input.notes,
          setup: snapshot,
          restUnknown: input.sets.some((s) => s.restSeconds === undefined),
          restSeconds: input.sets[0]?.restSeconds ?? 0,
          repMin: Math.min(...input.sets.map((s) => s.reps ?? 0)),
          repMax: Math.max(...input.sets.map((s) => s.reps ?? 0)),
          sets: input.sets.map((s) => ({
            reps: s.reps,
            loadKg: s.loadKg,
            durationSeconds: s.durationSeconds,
            distanceM: s.distanceM,
            label: s.label,
            restSeconds: s.restSeconds,
            notes:
              s.notes +
              (s.partialReps
                ? '\nSource workout included ' + s.partialReps + ' additional partial reps.'
                : ''),
          })),
        };
        items.push(item);
        input.sets.forEach((s, order) => {
          const row = SetSchema.parse({
            ...s,
            id: uid(),
            sessionId,
            itemId: item.id,
            exerciseId: exercise!.id,
            order,
            restSeconds: s.restSeconds ?? 0,
            restUnknown: s.restSeconds === undefined,
            setup: snapshot,
            completedAt: s.completed
              ? imported.dateOnly
                ? date.toISOString()
                : imported.endAt
              : undefined,
          });
          if (row.completed && mode !== 'routines') validateCompletion(row, item);
          sets.push(row);
        });
      }
      if (mode !== 'routines') {
        const start = imported.dateOnly ? date.toISOString() : imported.startAt;
        const end = imported.dateOnly ? date.toISOString() : imported.endAt;
        if (
          !start ||
          !end ||
          !Number.isFinite(Date.parse(start)) ||
          !Number.isFinite(Date.parse(end)) ||
          Date.parse(end) < Date.parse(start)
        )
          throw Error('Enter valid start and finish times or use a date-only entry.');
        const session = SessionSchema.parse({
          id: sessionId,
          name: imported.name,
          dateOnly: imported.dateOnly,
          importId,
          startAt: start,
          endAt: end,
          status: 'completed',
          items,
          groups: [],
          notes: imported.notes,
          updatedAt: now(),
        });
        await database.sessions.add(session);
        await database.sets.bulkAdd(sets);
        sessionIds.push(sessionId);
      }
      if (mode !== 'history') {
        const routine = RoutineSchema.parse({
          id: uid(),
          name: imported.name,
          description: imported.notes,
          color: '#4d8069',
          weekdays: [],
          items: items.map((i) => ({
            ...i,
            includeBodyweight: exercises.find((e) => e.id === i.exerciseId)!.includeBodyweight,
          })),
          groups: [],
          createdAt: now(),
          updatedAt: now(),
        });
        await database.routines.add(routine);
        routineIds.push(routine.id);
      }
    }
    const undoDigest = await importDigest(database, sessionIds, routineIds);
    workspace.imports.push({
      id: importId,
      fingerprint,
      workoutKeys,
      sessionIds,
      routineIds,
      undoDigest,
    });
    workspace.revision++;
    const remaining = valid.sessions.filter((s) => !s.selected);
    workspace.pasteDraft = remaining.length
      ? JSON.stringify({ ...valid, id: uid(), sessions: remaining })
      : undefined;
    await database.workspaces.put(WorkspaceSchema.parse(workspace));
    return { id: importId, sessionIds, routineIds };
  });
}
const dateKeyLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export async function undoWorkoutImport(id: string, database = db) {
  return database.transaction('rw', database.tables, async () => {
    const workspace = (await database.workspaces.get('workspace')) ?? defaultWorkspace();
    const batch = workspace.imports.find((i) => i.id === id);
    if (!batch) throw Error('Import was already removed.');
    if (
      !batch.undoDigest ||
      batch.undoDigest !== (await importDigest(database, batch.sessionIds, batch.routineIds))
    )
      throw Error(
        'This import has been edited. Remove individual sessions or routines instead to preserve your later changes.',
      );
    const otherSessions = await database.sessions.toArray();
    if (
      otherSessions.some(
        (s) =>
          !batch.sessionIds.includes(s.id) && s.routineId && batch.routineIds.includes(s.routineId),
      )
    )
      throw Error(
        'An imported routine has been used since import. Remove individual records instead.',
      );
    for (const sessionId of batch.sessionIds) {
      await database.sets.where('sessionId').equals(sessionId).delete();
      await database.sessions.delete(sessionId);
    }
    for (const routineId of batch.routineIds) await database.routines.delete(routineId);
    workspace.imports = workspace.imports.filter((i) => i.id !== id);
    workspace.revision++;
    await database.workspaces.put(WorkspaceSchema.parse(workspace));
  });
}

// A deterministic change detector, not a security hash; IndexedDB work stays in one transaction.
async function importDigest(database: typeof db, sessionIds: string[], routineIds: string[]) {
  const sessions = await database.sessions.bulkGet(sessionIds),
    routines = await database.routines.bulkGet(routineIds);
  const sets = (await database.sets.toArray())
    .filter((s) => sessionIds.includes(s.sessionId))
    .sort((a, b) => a.id.localeCompare(b.id));
  const text = JSON.stringify({ sessions, routines, sets }, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16) + ':' + text.length;
}

export function reviewedWorkoutKey({
  selected: _s,
  accepted: _a,
  warnings: _w,
  ...session
}: WorkoutDraft['sessions'][number]) {
  return contentKey(JSON.stringify(session));
}
