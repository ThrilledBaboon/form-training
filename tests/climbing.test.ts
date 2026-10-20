import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { TrainingDB, readData } from '../src/lib/db';
import { uid, now } from '../src/lib/model';
import {
  ClimbingDataSchema,
  climbSnapshot,
  emptyClimbing,
  climbingGradeGroups,
  climbingActivity,
  climbingWallSummary,
  climbingWeek,
} from '../src/lib/climbing-model';
import {
  newClimb,
  saveClimbingRecord,
  deleteClimbingSession,
  saveClimbingGoal,
} from '../src/lib/climbing-actions';
import { importBackup, parseBackup, serialise } from '../src/lib/backup';
import { categoryExport } from '../src/lib/category-backup';
import { ensureSystemHomePage, setSystemEnabled } from '../src/lib/workspace';
import { requiredSystems } from '../src/lib/widget-registry';
import { exportLayout, parseLayout } from '../src/lib/layout-sharing';
import { systemHomePage } from '../src/lib/workspace-model';
let db: TrainingDB;
beforeEach(async () => {
  db = new TrainingDB('climbing-' + uid());
  await db.open();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});
async function sample() {
  const c = {
    ...newClimb(),
    name: 'Purple corner',
    venue: 'Local gym',
    grade: 'Purple',
    gradeScale: 'Gym colours',
    project: 'active' as const,
  };
  await saveClimbingRecord('climbs', c, undefined, db);
  const s = {
    id: uid(),
    name: 'Mixed evening',
    date: '2026-10-15',
    notes: 'Good session',
    status: 'completed' as const,
    updatedAt: now(),
    entries: [
      {
        id: uid(),
        climbId: c.id,
        snapshot: climbSnapshot(c),
        attempts: 3,
        result: 'completed' as const,
        notes: 'Try left foot higher',
      },
    ],
  };
  await saveClimbingRecord('sessions', s, undefined, db);
  return {
    c: (await readData(db)).climbing!.climbs[0],
    s: (await readData(db)).climbing!.sessions[0],
  };
}
describe('Climbing system', () => {
  it('counts wall styles from historical snapshots, keeps missing styles unrecorded and excludes drafts', async () => {
    const { c, s } = await sample();
    const tagged = {
      ...s,
      entries: [
        { ...s.entries[0], snapshot: { ...s.entries[0].snapshot, wallStyle: 'overhang' as const } },
        {
          ...s.entries[0],
          id: 'flash',
          attempts: 1,
          result: 'flash' as const,
          snapshot: { ...s.entries[0].snapshot, wallStyle: 'overhang' as const },
        },
        {
          ...s.entries[0],
          id: 'rested',
          attempts: 2,
          result: 'with_rests' as const,
          snapshot: { ...s.entries[0].snapshot, wallStyle: 'roof' as const },
        },
        { ...s.entries[0], id: 'unknown' },
      ],
    };
    await saveClimbingRecord('climbs', { ...c, wallStyle: 'slab' }, c.updatedAt, db);
    const summary = climbingWallSummary([tagged, { ...tagged, status: 'draft' }]);
    expect(summary.untagged).toBe(1);
    expect(summary.rows.find((r) => r.style === 'overhang')).toMatchObject({
      attempts: 4,
      completions: 2,
      flashes: 1,
      climbs: 1,
      sessions: 1,
    });
    expect(summary.rows.find((r) => r.style === 'roof')).toMatchObject({
      attempts: 2,
      completions: 0,
    });
    expect(summary.rows.find((r) => r.style === 'slab')!.attempts).toBe(0);
    expect(
      (await readData(db)).climbing!.sessions[0].entries[0].snapshot.wallStyle,
    ).toBeUndefined();
  });
  it('counts only completed visits in the current Monday-Sunday week and keeps the climbing goal independent from Gym', async () => {
    const { s } = await sample();
    const sessions = ['2026-10-18', '2026-10-19', '2026-10-19', '2026-10-20'].map((date, i) => ({
      ...s,
      id: String(i),
      date,
    }));
    sessions.push({ ...s, date: '2026-10-19', status: 'draft' });
    const data = { ...emptyClimbing, sessions, goal: { weeklySessions: 3, updatedAt: now() } };
    expect(climbingWeek(data, '2026-10-19')).toEqual({
      from: '2026-10-19',
      to: '2026-10-25',
      completed: 2,
      target: 3,
    });
    expect(climbingWeek(data, '2026-10-18').completed).toBe(1);
    expect(climbingWeek(emptyClimbing, '2026-10-19').target).toBeUndefined();
    const before = await readData(db);
    await saveClimbingGoal(3, undefined, db);
    const first = (await readData(db)).climbing!.goal!;
    expect(first.weeklySessions).toBe(3);
    expect((await readData(db)).settings).toEqual(before.settings);
    await expect(saveClimbingGoal(4, undefined, db)).rejects.toThrow('another tab');
    await expect(saveClimbingGoal(0, first.updatedAt, db)).rejects.toThrow();
    await saveClimbingGoal(2, first.updatedAt, db);
    expect((await readData(db)).climbing!.goal!.weeklySessions).toBe(2);
  });
  it('backs up wall snapshots and goals, keeps local goals on merge and defaults old backups to unrecorded styles', async () => {
    const { c, s } = await sample();
    await saveClimbingRecord(
      'sessions',
      {
        ...s,
        entries: [{ ...s.entries[0], snapshot: { ...s.entries[0].snapshot, wallStyle: 'roof' } }],
      },
      s.updatedAt,
      db,
    );
    await saveClimbingGoal(3, undefined, db);
    const data = await readData(db);
    const exported = parseBackup(categoryExport(data, ['climbing']));
    expect(exported.data.climbing.goal!.weeklySessions).toBe(3);
    expect(exported.data.climbing.sessions[0].entries[0].snapshot.wallStyle).toBe('roof');
    await saveClimbingGoal(2, data.climbing!.goal!.updatedAt, db);
    await importBackup(exported, 'merge', db);
    expect((await readData(db)).climbing!.goal!.weeklySessions).toBe(2);
    expect(
      parseBackup(
        serialise({ ...data, climbing: { ...emptyClimbing, climbs: [c], sessions: [s] } }),
      ).data.climbing.sessions[0].entries[0].snapshot.wallStyle,
    ).toBeUndefined();
    const page = systemHomePage('climbing');
    const shared = parseLayout(exportLayout(page, data));
    expect(shared.page.widgets.map((w) => w.type)).toEqual(
      expect.arrayContaining(['climbing-wall-map', 'climbing-week']),
    );
    expect(exportLayout(page, data)).not.toContain('weeklySessions');
  });
  it('adds the new map and weekly widgets only to untouched early climbing homes', async () => {
    const page = systemHomePage('climbing');
    page.widgets = page.widgets.filter(
      (w) => !['climbing-week', 'climbing-wall-map', 'climbing-trend'].includes(w.type),
    );
    const data = await readData(db);
    await db.workspaces.put({ ...data.workspace!, pages: [...data.workspace!.pages, page] });
    await ensureSystemHomePage('climbing', db);
    const updated = (await readData(db)).workspace!.pages.find((p) => p.id === page.id)!;
    expect(updated.widgets.map((w) => w.type)).toContain('climbing-wall-map');
    const custom = { ...page, revision: 1, name: 'My wall' };
    await db.workspaces.put({ ...data.workspace!, pages: [...data.workspace!.pages, custom] });
    await ensureSystemHomePage('climbing', db);
    expect((await readData(db)).workspace!.pages.find((p) => p.id === page.id)).toEqual(custom);
  });
  it('charts recorded days chronologically, sums same-day visits and excludes drafts and rested completions', async () => {
    const { s } = await sample();
    const flash = {
      ...s,
      date: '2026-10-10',
      entries: [{ ...s.entries[0], attempts: 1, result: 'flash' as const }],
    };
    const rested = {
      ...s,
      entries: [{ ...s.entries[0], attempts: 2, result: 'with_rests' as const }],
    };
    const draft = { ...s, status: 'draft' as const };
    expect(climbingActivity([s, flash, rested, draft])).toEqual([
      { date: '2026-10-10', value: 1, completions: 1 },
      { date: '2026-10-15', value: 5, completions: 1 },
    ]);
    expect(climbingActivity([draft])).toEqual([]);
  });
  it('persists a mixed history snapshot independently from library edits, archives and disabled systems', async () => {
    const { c, s } = await sample();
    await saveClimbingRecord(
      'climbs',
      { ...c, name: 'Reset wall', grade: 'Red', archived: true },
      c.updatedAt,
      db,
    );
    await ensureSystemHomePage('climbing', db);
    const before = await readData(db);
    expect(
      before
        .workspace!.pages.find((p) => p.id === 'climbing-home')!
        .widgets.every((w) => requiredSystems(w).includes('climbing')),
    ).toBe(true);
    await setSystemEnabled('climbing', false, db);
    db.close();
    await db.open();
    const data = await readData(db);
    expect(data.climbing!.sessions[0]).toEqual(s);
    expect(data.climbing!.sessions[0].entries[0].snapshot.grade).toBe('Purple');
    expect(data.workspace!.systems.climbing).toBe(false);
    expect(data.sessions).toEqual(before.sessions);
    const undo = await deleteClimbingSession(s.id, s.updatedAt, db);
    expect((await readData(db)).climbing!.sessions).toHaveLength(0);
    await undo();
    expect((await readData(db)).climbing!.sessions).toEqual([s]);
  });
  it('rejects invalid references, duplicate identities, false flashes and stale edits atomically', async () => {
    const { c, s } = await sample();
    await saveClimbingRecord('climbs', { ...c, notes: 'new cue' }, c.updatedAt, db);
    await expect(saveClimbingRecord('climbs', c, c.updatedAt, db)).rejects.toThrow('another tab');
    await expect(
      saveClimbingRecord(
        'sessions',
        { ...s, entries: [{ ...s.entries[0], result: 'flash' }] },
        s.updatedAt,
        db,
      ),
    ).rejects.toThrow('flash');
    await expect(
      saveClimbingRecord(
        'sessions',
        { ...s, entries: [{ ...s.entries[0], climbId: 'missing' }] },
        s.updatedAt,
        db,
      ),
    ).rejects.toThrow('missing');
    expect((await readData(db)).climbing!.sessions).toEqual([s]);
    expect(() => ClimbingDataSchema.parse({ ...emptyClimbing, climbs: [c, c] })).toThrow(
      'Duplicate',
    );
  });
  it('does not lose independent simultaneous writes', async () => {
    const a = { ...newClimb(), name: 'A' },
      b = { ...newClimb(), name: 'B' };
    await Promise.all([
      saveClimbingRecord('climbs', a, undefined, db),
      saveClimbingRecord('climbs', b, undefined, db),
    ]);
    expect((await readData(db)).climbing!.climbs).toHaveLength(2);
  });
  it('round trips photos and records, merges without overwriting edits and rolls back a failed restore', async () => {
    const { c } = await sample();
    const photo = {
      id: uid(),
      name: 'Wall.png',
      mime: 'image/png' as const,
      data: 'data:image/png;base64,aGVsbG8=',
      createdAt: now(),
    };
    await saveClimbingRecord('climbs', { ...c, photo }, c.updatedAt, db);
    const original = await readData(db),
      backup = parseBackup(serialise(original));
    expect(backup.schemaVersion).toBe(6);
    expect(backup.manifest!.attachments).toBe(1);
    const changed = (await readData(db)).climbing!.climbs[0];
    await saveClimbingRecord('climbs', { ...changed, notes: 'Keep local' }, changed.updatedAt, db);
    await importBackup(backup, 'merge', db);
    expect((await readData(db)).climbing!.climbs[0].notes).toBe('Keep local');
    const before = await readData(db),
      count = await db.backups.count();
    const spy = vi.spyOn(db.climbing, 'put').mockRejectedValueOnce(Error('disk full'));
    await expect(importBackup(backup, 'replace', db)).rejects.toThrow('disk full');
    expect(await readData(db)).toEqual(before);
    expect(await db.backups.count()).toBe(count);
    spy.mockRestore();
    await importBackup(backup, 'replace', db);
    expect((await readData(db)).climbing).toEqual(original.climbing);
    const category = parseBackup(categoryExport(original, ['climbing']));
    expect(category.data.climbing).toEqual(original.climbing);
    expect(category.data.sessions).toEqual([]);
    expect(category.manifest!.categories).toContain('climbing');
    expect(categoryExport(original, ['recipes'])).not.toContain('Purple corner');
  });
  it('upgrades a real version 4 database with both old system preferences preserved', async () => {
    const name = 'old-climbing-' + uid(),
      legacy = new Dexie(name);
    legacy.version(4).stores({ workspaces: 'id' });
    await legacy.open();
    const workspace = (await readData(db)).workspace!;
    const oldSystems = { gym: false, food: true };
    await legacy.table('workspaces').put({ ...workspace, systems: oldSystems });
    legacy.close();
    const upgraded = new TrainingDB(name);
    await upgraded.open();
    const data = await readData(upgraded);
    expect(data.workspace!.systems).toEqual({
      ...oldSystems,
      climbing: true,
      'rocket-league': false,
      football: false,
    });
    expect(data.climbing).toEqual(emptyClimbing);
    await upgraded.delete();
    const backup = JSON.parse(serialise(await readData(db)));
    backup.schemaVersion = 4;
    backup.manifest.version = 4;
    delete backup.data.climbing;
    delete backup.data.workspace.systems.climbing;
    expect(parseBackup(JSON.stringify(backup)).data.climbing).toEqual(emptyClimbing);
  });
  it('shares climbing layouts without sharing any library entries or photos and keeps scales separate', async () => {
    const { s } = await sample();
    await ensureSystemHomePage('climbing', db);
    const data = await readData(db),
      page = data.workspace!.pages.find((p) => p.id === 'climbing-home')!;
    const shared = exportLayout(page, data);
    expect(shared).not.toContain('Purple corner');
    expect(shared).not.toContain('Local gym');
    expect(
      parseLayout(shared).page.widgets.some((w) => w.requiredSystems.includes('climbing')),
    ).toBe(true);
    const other = structuredClone(s);
    other.entries[0].snapshot.venue = 'Other gym';
    expect(climbingGradeGroups([s, other])).toHaveLength(2);
  });
});
