import { db, readData, type TrainingDB } from './db';
import { importBackup, parseBackup, serialise } from './backup';
import { createJackDemo, DEMO_PREFIX, demoId } from './demo-data';
import { foodTables, validateFood } from './food-model';
import { WorkspaceSchema } from './workspace-model';

const beforeId = demoId('before');
const afterId = demoId('after');
export const localDemoAvailable = () =>
  ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const isDemo = (id: string) => id.startsWith(DEMO_PREFIX);

export async function loadJackDemo(database: TrainingDB = db, today?: string) {
  return database.transaction('rw', database.tables, async () => {
    if (await database.backups.get(beforeId)) return false;
    const before = await readData(database);
    const demo = createJackDemo(today);
    const at = new Date().toISOString();
    await database.backups.add({
      id: beforeId,
      createdAt: at,
      reason: 'Original records before Jack demo data',
      json: serialise(before),
    });
    await importBackup(parseBackup(serialise(demo)), 'merge', database);
    const workspace = (await readData(database)).workspace!;
    if (!workspace.profile?.name.trim())
      workspace.profile = { ...workspace.profile, name: 'Jack', onboarding: 'completed' };
    await database.workspaces.put(WorkspaceSchema.parse(workspace));
    const settings = before.food!.foodSettings;
    await database.foodSettings.put({
      ...settings,
      targets: Object.keys(settings.targets).length
        ? settings.targets
        : demo.food!.foodSettings.targets,
      weeklyBudget: settings.weeklyBudget ?? demo.food!.foodSettings.weeklyBudget,
      monthlyBudget: settings.monthlyBudget ?? demo.food!.foodSettings.monthlyBudget,
    });
    if (!before.bodyweights.length && before.settings.goalKg === undefined)
      await database.settings.put({ ...before.settings, goalKg: demo.settings.goalKg });
    await database.backups.add({
      id: afterId,
      createdAt: at,
      reason: 'Jack demo data starting snapshot',
      json: serialise(await readData(database)),
    });
    return true;
  });
}

/** Restore only preferences still equal to our defaults; keep subsequent user edits. */
function undoDefaults<T>(before: T, after: T, current: T): T {
  if (JSON.stringify(current) === JSON.stringify(after)) return structuredClone(before);
  if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
  const result = { ...current } as Record<string, unknown>;
  const old = (before ?? {}) as Record<string, unknown>;
  const seeded = (after ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(seeded)) {
    if (
      JSON.stringify(old[key]) !== JSON.stringify(seeded[key]) &&
      JSON.stringify(result[key]) === JSON.stringify(seeded[key])
    ) {
      if (old[key] === undefined) delete result[key];
      else result[key] = old[key];
    }
  }
  return result as T;
}

export async function removeJackDemo(database: TrainingDB = db) {
  return database.transaction('rw', database.tables, async () => {
    const original = await database.backups.get(beforeId);
    const seeded = await database.backups.get(afterId);
    if (!original || !seeded) throw Error('No Jack demo load was found in this browser.');
    const current = await readData(database);
    const before = parseBackup(original.json).data;
    const after = parseBackup(seeded.json).data;
    await database.backups.add({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      reason: 'Before removing Jack demo data',
      json: serialise(current),
    });
    const workspace = current.workspace!;
    workspace.profile = undoDefaults(
      before.workspace?.profile,
      after.workspace?.profile,
      workspace.profile,
    );
    workspace.pages = workspace.pages.filter((p) => !isDemo(p.id));
    workspace.removedPages = workspace.removedPages.filter((p) => !isDemo(p.id));
    workspace.setups = workspace.setups.filter((p) => !isDemo(p.id));
    if (!workspace.pages.some((p) => p.id === workspace.homePageId))
      workspace.homePageId = 'overview';
    workspace.revision++;
    const tables = [
      'exercises',
      'mappings',
      'routines',
      'programmes',
      'plans',
      'sessions',
      'sets',
      'bodyweights',
      ...foodTables,
    ] as const;
    const rows: { table: string; row: { id: string } }[] = [];
    for (const table of tables)
      for (const row of await database.table(table).toArray()) rows.push({ table, row });
    const sampleRows = new Map(
      rows.filter(({ row }) => isDemo(row.id)).map(({ row }) => [row.id, row]),
    );
    const keep = new Set<string>();
    const references = (value: unknown) => {
      if (typeof value === 'string' && sampleRows.has(value) && !keep.has(value)) {
        keep.add(value);
        references(sampleRows.get(value));
      } else if (Array.isArray(value)) value.forEach(references);
      else if (value && typeof value === 'object') Object.values(value).forEach(references);
    };
    // Keep sample library dependencies if a new, real record now uses them.
    rows.filter(({ row }) => !isDemo(row.id)).forEach(({ row }) => references(row));
    references(workspace);
    let size: number;
    do {
      size = keep.size;
      for (const { table, row } of rows) {
        const related = row as {
          id: string;
          sessionId?: string;
          stockId?: string;
          batchId?: string;
        };
        if (
          (table === 'sets' && related.sessionId && keep.has(related.sessionId)) ||
          (table === 'movements' &&
            ((related.stockId && keep.has(related.stockId)) ||
              (related.batchId && keep.has(related.batchId))))
        )
          references(row.id);
      }
    } while (size !== keep.size);
    for (const table of tables)
      await database
        .table(table)
        .bulkDelete(
          rows
            .filter(
              (entry) => entry.table === table && isDemo(entry.row.id) && !keep.has(entry.row.id),
            )
            .map(({ row }) => row.id),
        );
    await database.workspaces.put(WorkspaceSchema.parse(workspace));
    await database.settings.put(undoDefaults(before.settings, after.settings, current.settings));
    await database.foodSettings.put(
      undoDefaults(before.food.foodSettings, after.food.foodSettings, current.food!.foodSettings),
    );
    validateFood((await readData(database)).food!);
    await database.backups.bulkDelete([beforeId, afterId]);
    return keep.size;
  });
}
