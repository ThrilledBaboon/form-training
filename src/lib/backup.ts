import { WorkspaceSchema, defaultWorkspace } from './workspace-model';
import { z } from 'zod';
import { dateKey } from './calc';
import { validateCompletion } from './actions';
import { db, readData, type TrainingDB } from './db';
import { FoodDataSchema, emptyFood, foodTables, validateFood } from './food-model';
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
  schemaVersion: z.literal(4),
  exportedAt: z.string().datetime({ offset: true }),
  manifest: z
    .object({
      format: z.enum(['FORM complete backup', 'FORM category export']),
      version: z.literal(4),
      categories: z.array(z.string()),
      requested: z.array(z.string()).optional(),
      attachments: z.number().int().nonnegative(),
    })
    .optional(),
  scope: z.enum(['complete', 'categories']).default('complete'),
  data: z.object({
    workspace: WorkspaceSchema.optional(),
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
    food: FoodDataSchema.default(emptyFood),
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
  // A retired legacy session metric stays in existing storage, but must never enter exports.
  const sessions = data.sessions.map(({ calories: _retired, ...session }) => session);
  const food = data.food ?? structuredClone(emptyFood);
  if (data.foodFileIds?.some((id) => !food.foodFiles.some((file) => file.id === id)))
    throw Error('Attachments have not been loaded. Read the complete database before exporting.');
  const output = JSON.stringify(
    {
      app: 'FORM',
      schemaVersion: 4,
      exportedAt: now(),
      scope: 'complete',
      manifest: {
        format: 'FORM complete backup',
        version: 4,
        categories: [...entities, 'workspace', 'settings', 'timer', ...foodTables, 'foodSettings'],
        attachments: food.foodFiles.length,
      },
      data: {
        ...data,
        workspace: data.workspace ?? defaultWorkspace(),
        foodFileIds: undefined,
        sessions,
        food,
      },
    },
    null,
    2,
  );
  if (output.length > 100 * 1024 * 1024)
    throw Error(
      'This backup exceeds the 100 MB restore limit. Export selected categories instead; no data was omitted.',
    );
  return output;
}
export function parseBackup(input: string): Backup {
  if (input.length > 100 * 1024 * 1024) throw Error('Backup exceeds the 100 MB import limit.');
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw Error('This file is not valid JSON. No records were changed.');
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    value.schemaVersion === 2
  ) {
    value = {
      ...value,
      schemaVersion: 4,
      scope: 'complete',
      manifest: undefined,
      data: { ...(value as { data?: object }).data, food: structuredClone(emptyFood) },
    };
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    value.schemaVersion === 3
  ) {
    const old = value as { manifest?: object };
    value = {
      ...value,
      schemaVersion: 4,
      manifest: old.manifest ? { ...old.manifest, version: 4 } : undefined,
    };
  }
  const parsed = BackupSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw Error(
      `Invalid backup at ${issue.path.join('.')}: ${issue.code === 'unrecognized_keys' ? 'Unsupported fields in this record' : issue.message}. Expected a FORM schema version 2, 3 or 4 backup.`,
    );
  }
  const b = parsed.data;
  const d = b.data;
  if (b.manifest && b.manifest.attachments !== d.food.foodFiles.length)
    throw Error(
      'The attachment count does not match the backup manifest. No records were changed.',
    );
  validateFood(d.food);
  for (const key of entities) {
    const ids = d[key].map((x) => x.id);
    if (new Set(ids).size !== ids.length) throw Error(`Duplicate identifiers inside ${key}.`);
  }
  const exercises = new Set(d.exercises.map((e) => e.id));
  if (d.workspace?.setups.some((s) => !exercises.has(s.exerciseId)))
    throw Error('An equipment setup references a missing exercise.');
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
  const gym = entities.map((key) => {
    const existing = new Set(current[key].map((row) => row.id));
    return {
      table: key,
      total: backup.data[key].length,
      duplicates: backup.data[key].filter((row) => existing.has(row.id)).length,
    };
  });
  return [
    ...gym,
    {
      table: 'workspace pages',
      total: backup.data.workspace?.pages.length ?? 0,
      duplicates:
        backup.data.workspace?.pages.filter((p) =>
          current.workspace?.pages.some((c) => c.id === p.id),
        ).length ?? 0,
    },
    ...foodTables.map((key) => {
      const existing = new Set(
        key === 'foodFiles' && current.foodFileIds
          ? current.foodFileIds
          : (current.food ?? emptyFood)[key].map((row) => row.id),
      );
      return {
        table: key,
        total: backup.data.food[key].length,
        duplicates: backup.data.food[key].filter((row) => existing.has(row.id)).length,
      };
    }),
  ];
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
  options: { restorePreferences?: boolean } = {},
) {
  const checked = parseBackup(JSON.stringify(backup));
  const data = checked.data;
  if (checked.scope === 'categories' && mode === 'replace')
    throw Error('Category files support merge only. Use a complete backup for full replacement.');
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
      await database.workspaces.put(data.workspace ?? defaultWorkspace());
      await database.settings.clear();
      await database.timers.clear();
      for (const key of entities)
        if (data[key].length) await database.table(key).bulkPut(data[key]);
      await database.settings.put(data.settings);
      if (data.timer) await database.timers.put(data.timer);
      for (const key of foodTables) {
        await database.table(key).clear();
        if (data.food[key].length) await database.table(key).bulkPut(data.food[key]);
      }
      await database.foodSettings.clear();
      await database.foodSettings.put(data.food.foodSettings);
    } else {
      const currentFood = before.food ?? emptyFood;
      const existingBatches = new Set(currentFood.batches.map((b) => b.id));
      const existingStock = new Set(currentFood.stock.map((s) => s.id));
      const existingPurchases = new Set(currentFood.purchases.map((p) => p.id));
      const existingEntries = new Set(currentFood.foodEntries.map((e) => e.id));
      const existingMovements = new Set(currentFood.movements.map((m) => m.id));
      if (
        data.food.foodEntries.some(
          (e) => !existingEntries.has(e.id) && e.batchId && existingBatches.has(e.batchId),
        ) ||
        data.food.movements.some(
          (m) =>
            !existingMovements.has(m.id) &&
            ((m.batchId && existingBatches.has(m.batchId)) ||
              (m.stockId && existingStock.has(m.stockId))),
        ) ||
        data.food.stock.some(
          (s) => !existingStock.has(s.id) && s.purchaseId && existingPurchases.has(s.purchaseId),
        )
      )
        throw Error(
          'New inventory events conflict with existing stock, batch or purchase balances. Use a complete replacement backup to restore this snapshot, or record the change in the app. No records were changed.',
        );
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
      const combined = structuredClone(before.food ?? emptyFood);
      for (const key of foodTables) {
        const existing = new Set(combined[key].map((row) => row.id));
        const incoming = data.food[key].filter((row) => !existing.has(row.id));
        if (incoming.length) await database.table(key).bulkAdd(incoming);
        Object.assign(combined, { [key]: [...combined[key], ...incoming] });
      }
      validateFood(combined);
      if (data.workspace) {
        const workspace = structuredClone(before.workspace ?? defaultWorkspace());
        workspace.pages.push(
          ...data.workspace.pages.filter((p) => !workspace.pages.some((c) => c.id === p.id)),
        );
        workspace.setups.push(
          ...data.workspace.setups.filter((p) => !workspace.setups.some((c) => c.id === p.id)),
        );
        workspace.planBuilds = [
          ...new Set([...(workspace.planBuilds ?? []), ...data.workspace.planBuilds]),
        ];
        workspace.imports.push(
          ...data.workspace.imports.filter((p) => !workspace.imports.some((c) => c.id === p.id)),
        );
        if (
          options.restorePreferences &&
          (checked.scope === 'complete' || checked.manifest?.categories.includes('workspace'))
        ) {
          workspace.systems = data.workspace.systems;
          workspace.homePageId = data.workspace.homePageId;
          workspace.pasteDraft = data.workspace.pasteDraft;
          workspace.profile = data.workspace.profile;
        }
        workspace.revision++;
        await database.workspaces.put(WorkspaceSchema.parse(workspace));
      }
      if (options.restorePreferences) {
        const includes = (key: string) =>
          checked.scope === 'complete' || checked.manifest?.categories.includes(key);
        if (includes('settings')) await database.settings.put(data.settings);
        if (includes('timer')) {
          await database.timers.clear();
          if (data.timer) await database.timers.put(data.timer);
        }
        if (includes('foodSettings')) await database.foodSettings.put(data.food.foodSettings);
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
      ['id', 'name', 'start', 'end', 'status', 'notes', 'rpe', 'energy', 'date_only'],
      ...data.sessions.map((s) => [
        s.id,
        s.name,
        s.dateOnly ? dateKey(s.startAt) : s.startAt,
        s.dateOnly ? undefined : s.endAt,
        s.status,
        s.notes,
        s.rpe,
        s.energy,
        s.dateOnly ?? false,
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
        (() => {
          const session = data.sessions.find((x) => x.id === s.sessionId);
          return session?.dateOnly ? dateKey(session.startAt) : session?.startAt;
        })(),
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
      'partial_reps',
      'setup_name',
      'load_convention',
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
      s.restUnknown ? undefined : s.restSeconds,
      s.label,
      s.customLabel,
      s.completed,
      data.sessions.find((x) => x.id === s.sessionId)?.dateOnly ? undefined : s.completedAt,
      s.notes,
      s.partialReps,
      s.setup?.name,
      s.setup?.basis,
    ]),
  ]);
}
