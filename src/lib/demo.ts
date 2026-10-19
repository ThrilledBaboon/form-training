import { db, readData, type TrainingDB } from './db';
import { importBackup, parseBackup, serialise } from './backup';
import { createJackDemo, DEMO_PREFIX, demoId } from './demo-data';
import { foodTables, validateFood } from './food-model';
import { WorkspaceSchema } from './workspace-model';
import { ClimbingDataSchema, emptyClimbing, mergeClimbing } from './climbing-model';

const beforeId = demoId('before');
const afterId = demoId('after');
export const localDemoAvailable = () =>
  ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const isDemo = (id: string) => id.startsWith(DEMO_PREFIX);

export async function loadJackDemo(database: TrainingDB = db, today?: string) {
  return database.transaction('rw', database.tables, async () => {
    if (await database.backups.get(beforeId)) {
      const seeded = await database.backups.get(afterId);
      if (!seeded)
        throw Error('The original demo recovery snapshot is missing. No records were changed.');
      const after = parseBackup(seeded.json).data;
      // Upgrade older Gym/Food demos once, without re-adding edited or removed records.
      if (after.climbing.sessions.some((s) => isDemo(s.id))) {
        if (after.climbing.climbs.some((c) => c.wallStyle)) return false;
        const current = await readData(database);
        const demo = createJackDemo(today);
        await database.backups.add({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          reason: 'Before adding Jack demo wall styles',
          json: serialise(current),
        });
        const climbing = current.climbing!;
        const styles = new Map(demo.climbing!.climbs.map((c) => [c.id, c.wallStyle]));
        for (const baseline of after.climbing.climbs) {
          const row = climbing.climbs.find((c) => c.id === baseline.id);
          if (row && !row.wallStyle && JSON.stringify(row) === JSON.stringify(baseline))
            row.wallStyle = styles.get(row.id);
          baseline.wallStyle = styles.get(baseline.id);
        }
        for (const baseline of after.climbing.sessions) {
          const session = climbing.sessions.find((s) => s.id === baseline.id);
          for (const oldEntry of baseline.entries) {
            const entry = session?.entries.find((e) => e.id === oldEntry.id);
            if (
              entry &&
              !entry.snapshot.wallStyle &&
              JSON.stringify(entry.snapshot) === JSON.stringify(oldEntry.snapshot)
            )
              entry.snapshot.wallStyle = styles.get(entry.climbId);
            oldEntry.snapshot.wallStyle = styles.get(oldEntry.climbId);
          }
        }
        const workspace = current.workspace!;
        const template = demo.workspace!.pages.find((p) => p.id === demoId('climbing-page'))!;
        const page = workspace.pages.find((p) => p.id === template.id);
        const oldWidgets = template.widgets.filter((w) => w.type !== 'climbing-wall-map');
        if (
          page?.revision === 0 &&
          page.name === template.name &&
          JSON.stringify(page.widgets) === JSON.stringify(oldWidgets)
        ) {
          page.widgets = template.widgets;
          page.revision++;
          workspace.revision++;
          await database.workspaces.put(WorkspaceSchema.parse(workspace));
        }
        climbing.revision++;
        await database.climbing.put(ClimbingDataSchema.parse(climbing));
        await database.backups.put({ ...seeded, json: serialise(after) });
        return true;
      }
      const current = await readData(database);
      const demo = createJackDemo(today);
      await database.backups.add({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        reason: 'Before adding Jack climbing demo data',
        json: serialise(current),
      });
      await database.climbing.put(mergeClimbing(current.climbing ?? emptyClimbing, demo.climbing!));
      const workspace = current.workspace!;
      const page = demo.workspace!.pages.find((p) => p.id === demoId('climbing-page'))!;
      if (
        !workspace.pages.some((p) => p.id === page.id) &&
        !workspace.removedPages.some((p) => p.id === page.id)
      ) {
        workspace.pages.push(page);
        workspace.revision++;
        await database.workspaces.put(WorkspaceSchema.parse(workspace));
      }
      after.climbing = demo.climbing!;
      await database.backups.put({ ...seeded, json: serialise(after) });
      return true;
    }
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
    const climbing = current.climbing ?? structuredClone(emptyClimbing);
    for (const key of ['climbs', 'sessions', 'plans'] as const)
      for (const row of climbing[key]) rows.push({ table: 'climbing.' + key, row });
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
    for (const key of ['climbs', 'sessions', 'plans'] as const)
      Object.assign(climbing, {
        [key]: climbing[key].filter((row) => !isDemo(row.id) || keep.has(row.id)),
      });
    climbing.revision++;
    await database.climbing.put(ClimbingDataSchema.parse(climbing));
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
