import { db } from './db';
import { now } from './model';
import { SetupSnapshotSchema } from './workspace-model';
import {
  WorkspaceSchema,
  PageSchema,
  SetupSchema,
  defaultWorkspace,
  systemHomePage,
  type Workspace,
  type WorkspacePage,
  type EquipmentSetup,
} from './workspace-model';

export function ensureSystemHomePage(system: 'gym' | 'food', database = db) {
  return changeWorkspace((w) => {
    const page = systemHomePage(system);
    if (!w.pages.some((p) => p.id === page.id)) w.pages.push(page);
  }, database);
}

/** Read-modify-write in one transaction prevents a preference change losing page edits. */
export async function changeWorkspace(change: (current: Workspace) => void, database = db) {
  return database.transaction('rw', database.workspaces, async () => {
    const current = (await database.workspaces.get('workspace')) ?? defaultWorkspace();
    change(current);
    current.revision++;
    const valid = WorkspaceSchema.parse(current);
    await database.workspaces.put(valid);
    return valid;
  });
}
export async function savePage(page: WorkspacePage, expectedRevision: number, database = db) {
  return changeWorkspace((w) => {
    const previous = w.pages.find((p) => p.id === page.id);
    if (
      (!previous && expectedRevision >= 0) ||
      (previous && previous.revision !== expectedRevision)
    )
      throw Error('This page changed in another tab. Reload the saved page before editing again.');
    const updated = PageSchema.parse({ ...page, revision: (previous?.revision ?? -1) + 1 });
    w.pages = previous
      ? w.pages.map((p) => (p.id === page.id ? updated : p))
      : [...w.pages, updated];
  }, database);
}
export async function saveSetup(profile: EquipmentSetup, database = db) {
  const valid = SetupSchema.parse(profile);
  return database.transaction('rw', [database.workspaces, database.exercises], async () => {
    if (!(await database.exercises.get(valid.exerciseId)))
      throw Error('Choose an existing exercise for this setup.');
    return changeWorkspace((w) => {
      if (valid.isDefault && !valid.archived)
        w.setups = w.setups.map((s) =>
          s.exerciseId === valid.exerciseId ? { ...s, isDefault: false } : s,
        );
      w.setups = [...w.setups.filter((s) => s.id !== valid.id), valid];
    }, database);
  });
}
export function moveEntry<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export async function applyEquipmentSetup(
  sessionId: string,
  itemId: string,
  setupId: string,
  database = db,
) {
  return database.transaction(
    'rw',
    [database.sessions, database.sets, database.workspaces],
    async () => {
      const workspace = (await database.workspaces.get('workspace')) ?? defaultWorkspace();
      const profile = workspace.setups.find((s) => s.id === setupId && !s.archived);
      const session = await database.sessions.get(sessionId);
      const item = session?.items.find((i) => i.id === itemId);
      if (!session || !item) throw Error('Workout exercise no longer exists.');
      if (setupId && (!profile || profile.exerciseId !== item.exerciseId))
        throw Error('Choose a setup for this exercise.');
      const snapshot = profile ? SetupSnapshotSchema.parse(profile) : undefined;
      await database.sessions.put({
        ...session,
        updatedAt: now(),
        items: session.items.map((i) => (i.id === itemId ? { ...i, setup: snapshot } : i)),
      });
      const sets = await database.sets.where('sessionId').equals(sessionId).toArray();
      await database.sets.bulkPut(
        sets
          .filter((s) => s.itemId === itemId && !s.completed)
          .map((s) => ({ ...s, setup: snapshot })),
      );
    },
  );
}

export async function setSystemEnabled(system: 'gym' | 'food', enabled: boolean, database = db) {
  return database.transaction('rw', [database.workspaces, database.timers], async () => {
    if (system === 'gym' && enabled) {
      const timer = await database.timers.get('rest');
      if (timer?.endAt && timer.endAt <= Date.now())
        await database.timers.update('rest', { notified: true });
    }
    return changeWorkspace((w) => {
      w.systems[system] = enabled;
    }, database);
  });
}
