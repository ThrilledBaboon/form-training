import { z } from 'zod';
import { db, readData, type TrainingDB } from './db';
import {
  ExerciseSchema,
  MappingSchema,
  RoutineSchema,
  ProgrammeSchema,
  now,
  uid,
  type Data,
  type Exercise,
  type Routine,
} from './model';

export const LIBRARY_LIMIT = 10 * 1024 * 1024;
const LibrarySchema = z
  .object({
    app: z.literal('FORM'),
    type: z.literal('library'),
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1).max(150),
    exportedAt: z.string().datetime({ offset: true }),
    data: z
      .object({
        exercises: z.array(ExerciseSchema).max(1000),
        mappings: z.array(MappingSchema).max(20000),
        routines: z.array(RoutineSchema).max(500),
        programmes: z.array(ProgrammeSchema).max(100),
      })
      .strict(),
  })
  .strict();
export type LibraryFile = z.infer<typeof LibrarySchema>;
export type LibrarySelection =
  { kind: 'library' } | { kind: 'exercise' | 'routine' | 'programme'; id: string };
export type ShareOptions = { notes: boolean; loads: boolean };

export function parseLibrary(input: string): LibraryFile {
  if (input.length > LIBRARY_LIMIT) throw Error('Library files must be smaller than 10 MB.');
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw Error('This file is not valid JSON.');
  }
  const result = LibrarySchema.safeParse(value);
  if (!result.success)
    throw Error('Choose a FORM library file (version 1). Full backups belong in Settings & data.');
  const file = result.data;
  const d = file.data;
  if (!d.exercises.length && !d.routines.length && !d.programmes.length)
    throw Error('This library file is empty.');
  for (const rows of Object.values(d))
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw Error('This library file contains duplicate identifiers.');
  const exercises = new Map(d.exercises.map((e) => [e.id, e]));
  const programmes = new Set(d.programmes.map((p) => p.id));
  const muscleKeys = new Set<string>();
  for (const m of d.mappings) {
    const key = JSON.stringify([m.exerciseId, m.muscle]);
    if (!exercises.has(m.exerciseId) || muscleKeys.has(key))
      throw Error('Invalid or repeated exercise muscle assignment.');
    muscleKeys.add(key);
  }
  for (const e of d.exercises)
    if (e.repMin > e.repMax) throw Error('An exercise has an invalid rep range.');
  for (const r of d.routines) {
    if (r.programmeId && !programmes.has(r.programmeId))
      throw Error('A routine references a missing programme.');
    const groups = new Set(r.groups.map((g) => g.id));
    if (
      groups.size !== r.groups.length ||
      new Set(r.items.map((i) => i.id)).size !== r.items.length
    )
      throw Error('A routine contains repeated exercises or groups with the same identifier.');
    for (const i of r.items) {
      const e = exercises.get(i.exerciseId);
      if (!e || i.tracking !== e.tracking || i.includeBodyweight !== e.includeBodyweight)
        throw Error('A routine references a missing or incompatible exercise.');
      if (i.repMin > i.repMax) throw Error('A routine has an invalid rep range.');
      if (
        (i.groupId && !groups.has(i.groupId)) ||
        i.sets.some((s) => s.groupId && !groups.has(s.groupId))
      )
        throw Error('A routine references a missing group.');
    }
  }
  return file;
}

export function createLibrary(
  data: Data,
  selection: LibrarySelection,
  options: ShareOptions,
): LibraryFile {
  const selected = selection.kind === 'library' ? undefined : selection.id;
  const programmes =
    selection.kind === 'library'
      ? data.programmes
      : selection.kind === 'programme'
        ? data.programmes.filter((p) => p.id === selected)
        : [];
  const routines =
    selection.kind === 'library'
      ? data.routines
      : selection.kind === 'routine'
        ? data.routines.filter((r) => r.id === selected)
        : selection.kind === 'programme'
          ? data.routines.filter((r) => r.programmeId === selected)
          : [];
  const needed = new Set(routines.flatMap((r) => r.items.map((i) => i.exerciseId)));
  const exercises = data.exercises.filter(
    (e) =>
      needed.has(e.id) ||
      (selection.kind === 'library'
        ? !e.archived
        : selection.kind === 'exercise' && e.id === selected),
  );
  if (
    selection.kind !== 'library' &&
    !(
      selection.kind === 'exercise'
        ? exercises
        : selection.kind === 'routine'
          ? routines
          : programmes
    ).length
  )
    throw Error('This library item no longer exists.');
  const title =
    selection.kind === 'library'
      ? 'My training library'
      : selection.kind === 'exercise'
        ? exercises[0].name
        : selection.kind === 'routine'
          ? routines[0].name
          : programmes[0].name;
  const file: LibraryFile = {
    app: 'FORM',
    type: 'library',
    schemaVersion: 1,
    title,
    exportedAt: now(),
    data: {
      exercises: exercises.map((e) => ({
        ...e,
        notes: options.notes ? e.notes : '',
        archived: false,
      })),
      mappings: data.mappings.filter((m) => exercises.some((e) => e.id === m.exerciseId)),
      programmes: programmes.map((p) => ({ ...p, notes: options.notes ? p.notes : '' })),
      routines: routines.map((r) => ({
        ...r,
        programmeId: programmes.some((p) => p.id === r.programmeId) ? r.programmeId : undefined,
        description: options.notes ? r.description : '',
        groups: r.groups.map((g) => ({ ...g, notes: options.notes ? g.notes : '' })),
        items: r.items.map((i) => ({
          ...i,
          setup: undefined,
          notes: options.notes ? i.notes : '',
          sets: i.sets.map((s) => ({
            ...s,
            notes: options.notes ? s.notes : undefined,
            loadKg: options.loads ? s.loadKg : undefined,
          })),
        })),
      })),
    },
  };
  // Round-trip through the allowlist: even unexpected runtime fields cannot enter a shared file.
  return parseLibrary(JSON.stringify(file));
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
const normal = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
const exerciseKey = (e: Exercise) =>
  JSON.stringify([
    normal(e.name),
    normal(e.equipment),
    e.tracking,
    e.unilateral,
    e.includeBodyweight,
  ]);
// Stable import identifiers let repeated files keep a recipient's later edits.
function sharedId(kind: string, value: unknown) {
  const s = stable(value);
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ s.charCodeAt(i);
  }
  return `shared-${kind}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}
function routineKey(r: Routine, exercises: Map<string, Exercise>) {
  const group = (id?: string) => (id ? r.groups.findIndex((g) => g.id === id) : null);
  return stable({
    name: normal(r.name),
    description: r.description,
    groups: r.groups.map(({ id: _id, ...g }) => g),
    items: r.items.map(({ id: _id, exerciseId, groupId, sets, ...i }) => ({
      ...i,
      exercise: exerciseKey(exercises.get(exerciseId)!),
      group: group(groupId),
      sets: sets.map(({ groupId, ...s }) => ({ ...s, group: group(groupId) })),
    })),
  });
}
export type ImportRow = {
  name: string;
  kind: 'exercise' | 'routine' | 'programme';
  action: 'add' | 'reuse';
};
export function previewLibrary(file: LibraryFile, current: Data, useSchedule = false) {
  const additions: LibraryFile['data'] = {
    exercises: [],
    mappings: [],
    routines: [],
    programmes: [],
  };
  const rows: ImportRow[] = [];
  const exerciseIds = new Map<string, string>();
  const programmeIds = new Map<string, string>();
  const incomingExercises = new Map(file.data.exercises.map((e) => [e.id, e]));
  const existingExercises = new Map(current.exercises.map((e) => [e.id, e]));
  const at = now();
  for (const e of file.data.exercises) {
    const key = exerciseKey(e);
    const id = sharedId('exercise', [e.id, key]);
    const existing = [...current.exercises, ...additions.exercises].find(
      (x) => x.id === id || (!x.archived && exerciseKey(x) === key),
    );
    const localId = existing?.id || id;
    exerciseIds.set(e.id, localId);
    rows.push({ name: e.name, kind: 'exercise', action: existing ? 'reuse' : 'add' });
    if (!existing) {
      additions.exercises.push({
        ...e,
        id: localId,
        archived: false,
        createdAt: at,
        updatedAt: at,
      });
      for (const m of file.data.mappings.filter((m) => m.exerciseId === e.id))
        additions.mappings.push({ ...m, id: uid(), exerciseId: localId });
    }
  }
  for (const p of file.data.programmes) {
    const id = sharedId('programme', [p.id, normal(p.name), p.notes]);
    const existing = [...current.programmes, ...additions.programmes].find(
      (x) => x.id === id || (normal(x.name) === normal(p.name) && x.notes === p.notes),
    );
    programmeIds.set(p.id, existing?.id || id);
    rows.push({ name: p.name, kind: 'programme', action: existing ? 'reuse' : 'add' });
    if (!existing) additions.programmes.push({ ...p, id });
  }
  for (const e of additions.exercises) existingExercises.set(e.id, e);
  for (const r of file.data.routines) {
    const key = routineKey(r, incomingExercises);
    const programmeId = r.programmeId ? programmeIds.get(r.programmeId) : undefined;
    const id = sharedId('routine', [r.id, key, programmeId]);
    const existing = [...current.routines, ...additions.routines].find(
      (x) =>
        x.id === id ||
        (x.programmeId === programmeId &&
          x.items.every((i) => existingExercises.has(i.exerciseId)) &&
          routineKey(x, existingExercises) === key),
    );
    rows.push({ name: r.name, kind: 'routine', action: existing ? 'reuse' : 'add' });
    if (existing) continue;
    const groups = new Map(r.groups.map((g) => [g.id, uid()]));
    additions.routines.push({
      ...r,
      id,
      programmeId,
      sortOrder: atOrder(current, additions.routines.length),
      weekdays: useSchedule ? [...new Set(r.weekdays)] : [],
      createdAt: at,
      updatedAt: at,
      groups: r.groups.map((g) => ({ ...g, id: groups.get(g.id)! })),
      items: r.items.map((i) => ({
        ...i,
        id: uid(),
        exerciseId: exerciseIds.get(i.exerciseId)!,
        groupId: i.groupId ? groups.get(i.groupId) : undefined,
        sets: i.sets.map((s) => ({ ...s, groupId: s.groupId ? groups.get(s.groupId) : undefined })),
      })),
    });
  }
  return {
    additions,
    rows,
    added: rows.filter((r) => r.action === 'add').length,
    reused: rows.filter((r) => r.action === 'reuse').length,
  };
}
function atOrder(current: Data, offset: number) {
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    Math.max(0, ...current.routines.map((r) => r.sortOrder ?? 0)) + offset + 1,
  );
}
export async function importLibrary(
  file: LibraryFile,
  useSchedule = false,
  database: TrainingDB = db,
) {
  const checked = parseLibrary(JSON.stringify(file));
  return database.transaction('rw', database.tables, async () => {
    const preview = previewLibrary(checked, await readData(database), useSchedule);
    for (const key of ['exercises', 'mappings', 'programmes', 'routines'] as const)
      if (preview.additions[key].length) await database.table(key).bulkAdd(preview.additions[key]);
    return { added: preview.added, reused: preview.reused };
  });
}
