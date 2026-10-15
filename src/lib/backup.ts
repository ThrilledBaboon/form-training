import { z } from 'zod';
import { validateCompletion } from './actions';
import { db, readData, type TrainingDB } from './db';
import {
  ExerciseSchema,
  MappingSchema,
  RoutineSchema,
  ProgrammeSchema,
  PlanSchema,
  SessionSchema,
  SetSchema,
  BodyweightSchema,
  SettingsSchema,
  TimerSchema,
  uid,
  now,
  type Data,
} from './model';
const BackupSchema = z.object({
  app: z.literal('FORM'),
  schemaVersion: z.literal(2),
  exportedAt: z.string().datetime({ offset: true }),
  data: z.object({
    exercises: z.array(ExerciseSchema).max(10000),
    mappings: z.array(MappingSchema).max(200000),
    routines: z.array(RoutineSchema).max(10000),
    programmes: z.array(ProgrammeSchema).max(10000),
    plans: z.array(PlanSchema).max(100000),
    sessions: z.array(SessionSchema).max(100000),
    sets: z.array(SetSchema).max(2000000),
    bodyweights: z.array(BodyweightSchema).max(100000),
    settings: SettingsSchema,
    timer: TimerSchema.optional(),
  }),
});
export type Backup = z.infer<typeof BackupSchema>;
const entities = [
  'exercises',
  'mappings',
  'routines',
  'programmes',
  'plans',
  'sessions',
  'sets',
  'bodyweights',
] as const;
export function serialise(data: Data) {
  return JSON.stringify({ app: 'FORM', schemaVersion: 2, exportedAt: now(), data }, null, 2);
}
export function parseBackup(input: string): Backup {
  if (input.length > 100 * 1024 * 1024) throw Error('Backup exceeds the 100 MB import limit.');
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw Error('This file is not valid JSON. No records were changed.');
  }
  const parsed = BackupSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw Error(
      `Invalid backup at ${issue.path.join('.')}: ${issue.message}. Expected a FORM schema version 2 backup.`,
    );
  }
  const b = parsed.data;
  const d = b.data;
  for (const key of entities) {
    const ids = d[key].map((x) => x.id);
    if (new Set(ids).size !== ids.length) throw Error(`Duplicate identifiers inside ${key}.`);
  }
  const exercises = new Set(d.exercises.map((e) => e.id));
  const programmes = new Set(d.programmes.map((p) => p.id));
  const routines = new Set(d.routines.map((p) => p.id));
  const sessions = new Map(d.sessions.map((s) => [s.id, s]));
  const mapKeys = new Set<string>();
  for (const m of d.mappings) {
    if (!exercises.has(m.exerciseId))
      throw Error('A muscle mapping references a missing exercise.');
    const k = m.exerciseId + ':' + m.muscle;
    if (mapKeys.has(k)) throw Error('Duplicate muscle assignment.');
    mapKeys.add(k);
  }
  for (const r of [...d.routines, ...d.plans, ...d.sessions]) {
    const itemIds = r.items.map((i) => i.id);
    if (new Set(itemIds).size !== itemIds.length)
      throw Error('Duplicate exercise item within a workout.');
    const groupIds = r.groups.map((g) => g.id);
    if (new Set(groupIds).size !== groupIds.length) throw Error('Duplicate group in a workout.');
    for (const i of r.items) {
      if (!exercises.has(i.exerciseId)) throw Error('A workout references a missing exercise.');
      if (i.groupId && !groupIds.includes(i.groupId))
        throw Error('A workout references a missing group.');
      if (i.sets.some((set) => set.groupId && !groupIds.includes(set.groupId)))
        throw Error('A planned set references a missing group.');
    }
  }
  for (const r of d.routines)
    if (r.programmeId && !programmes.has(r.programmeId))
      throw Error('A routine references a missing programme.');
  for (const s of d.sessions) {
    if (s.status === 'completed' && !s.endAt)
      throw Error('A completed workout is missing its end time.');
    if (s.endAt && Date.parse(s.endAt) < Date.parse(s.startAt))
      throw Error('A workout ends before it starts.');
  }
  for (const set of d.sets) {
    const s = sessions.get(set.sessionId);
    const item = s?.items.find((i) => i.id === set.itemId);
    if (!s || !item || item.exerciseId !== set.exerciseId)
      throw Error('A set references a missing or incompatible session exercise.');
    if (set.completed) validateCompletion(set, item);
    if (set.groupId && !s.groups.some((g) => g.id === set.groupId))
      throw Error('A set references a missing group.');
    if (set.rpe !== undefined && set.rir !== undefined) throw Error('A set has both RPE and RIR.');
  }
  if (d.sessions.filter((s) => s.status === 'active').length > 1)
    throw Error('A backup cannot contain multiple active workouts.');
  return b;
}
export function importPreview(backup: Backup, current: Data) {
  return entities.map((key) => {
    const existing = new Set(current[key].map((row) => row.id));
    return {
      table: key,
      total: backup.data[key].length,
      duplicates: backup.data[key].filter((row) => existing.has(row.id)).length,
    };
  });
}
export async function recoverySnapshot(reason: string, database = db) {
  const data = await readData(database);
  const record = { id: uid(), createdAt: now(), reason, json: serialise(data) };
  await database.backups.add(record);
  return record;
}
export async function importBackup(
  backup: Backup,
  mode: 'merge' | 'replace',
  database: TrainingDB = db,
) {
  const checked = parseBackup(JSON.stringify(backup));
  const data = checked.data;
  // Capture and restore in a single atomic transaction: no tab can change the source between them.
  await database.transaction('rw', database.tables, async () => {
    const before = await readData(database);
    await database.backups.add({
      id: uid(),
      createdAt: now(),
      reason: `Before ${mode} import`,
      json: serialise(before),
    });
    if (mode === 'replace') {
      for (const key of entities) await database.table(key).clear();
      await database.settings.clear();
      await database.timers.clear();
      for (const key of entities)
        if (data[key].length) await database.table(key).bulkPut(data[key]);
      await database.settings.put(data.settings);
      if (data.timer) await database.timers.put(data.timer);
    } else {
      const incomingActive = data.sessions.find(
        (s) => s.status === 'active' && !before.sessions.some((x) => x.id === s.id),
      );
      if (incomingActive && before.sessions.some((s) => s.status === 'active'))
        throw Error('Both databases have an active workout. Finish or cancel one before merging.');
      // Conflicting sessions are kept in their entirety; do not graft sets into existing snapshots.
      const existingSessions = new Set(before.sessions.map((s) => s.id));
      const blockedItems = new Set<string>();
      for (const r of data.sessions.filter((s) => existingSessions.has(s.id)))
        r.items.forEach((i) => blockedItems.add(i.id));
      for (const key of entities) {
        const existing = new Set((await database.table(key).toArray()).map((r) => r.id));
        let incoming = data[key].filter((row) => !existing.has(row.id));
        if (key === 'mappings')
          incoming = incoming.filter(
            (row) =>
              !before.mappings.some(
                (m) =>
                  m.exerciseId === (row as Data['mappings'][number]).exerciseId &&
                  m.muscle === (row as Data['mappings'][number]).muscle,
              ),
          );
        if (key === 'sets')
          incoming = incoming.filter(
            (row) => !existingSessions.has((row as Data['sets'][number]).sessionId),
          );
        if (incoming.length) await database.table(key).bulkAdd(incoming);
      }
    }
  });
}
export function download(text: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportJSON(database = db) {
  const at = now();
  download(serialise(await readData(database)), `form-backup-${at.slice(0, 10)}.json`);
  await database.settings.update('preferences', { lastBackupAt: at });
}
export function csv(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let s = value === undefined || value === null ? '' : String(value);
          if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(','),
    )
    .join('\r\n');
}
export function csvExport(data: Data, kind: 'sessions' | 'sets' | 'bodyweight' | 'exercises') {
  if (kind === 'bodyweight')
    return csv([
      ['id', 'date_time', 'bodyweight_kg', 'notes'],
      ...data.bodyweights.map((b) => [b.id, b.at, b.kg, b.notes]),
    ]);
  if (kind === 'sessions')
    return csv([
      ['id', 'name', 'start', 'end', 'status', 'notes', 'rpe', 'energy', 'calories'],
      ...data.sessions.map((s) => [
        s.id,
        s.name,
        s.startAt,
        s.endAt,
        s.status,
        s.notes,
        s.rpe,
        s.energy,
        s.calories,
      ]),
    ]);
  if (kind === 'exercises')
    return csv([
      [
        'exercise_id',
        'current_name',
        'session_id',
        'date_time',
        'set_id',
        'tracking',
        'reps',
        'external_or_assistance_kg',
        'bodyweight_kg',
        'seconds',
        'metres',
        'label',
        'completed',
      ],
      ...data.sets.map((s) => [
        s.exerciseId,
        data.exercises.find((e) => e.id === s.exerciseId)?.name,
        s.sessionId,
        data.sessions.find((x) => x.id === s.sessionId)?.startAt,
        s.id,
        data.sessions.find((x) => x.id === s.sessionId)?.items.find((i) => i.id === s.itemId)
          ?.tracking,
        s.reps,
        s.loadKg,
        s.bodyweightKg,
        s.durationSeconds,
        s.distanceM,
        s.label,
        s.completed,
      ]),
    ]);
  return csv([
    [
      'id',
      'session_id',
      'item_id',
      'exercise_id',
      'order',
      'reps',
      'load_or_assistance_kg',
      'bodyweight_kg',
      'duration_seconds',
      'distance_m',
      'rpe',
      'rir',
      'rest_seconds',
      'label',
      'custom_label',
      'completed',
      'completed_at',
      'notes',
    ],
    ...data.sets.map((s) => [
      s.id,
      s.sessionId,
      s.itemId,
      s.exerciseId,
      s.order,
      s.reps,
      s.loadKg,
      s.bodyweightKg,
      s.durationSeconds,
      s.distanceM,
      s.rpe,
      s.rir,
      s.restSeconds,
      s.label,
      s.customLabel,
      s.completed,
      s.completedAt,
      s.notes,
    ]),
  ]);
}
