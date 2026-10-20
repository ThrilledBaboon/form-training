import Dexie from 'dexie';
import { weeklyReview } from '../src/lib/weekly-review';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import {
  changePractice,
  savePracticeLibrary,
  startPractice,
  practiceCommand,
  deletePracticeSession,
} from '../src/lib/practice-actions';
import {
  PracticeDataSchema,
  PracticeRowsSchema,
  DrillSchema,
  comparisonKey,
  resultValue,
  timerSeconds,
  practiceData,
  emptyPractice,
} from '../src/lib/practice-model';
import {
  rocketLeagueStarters,
  footballStarters,
  addPracticeStarters,
  importPracticeLibrary,
  parsePracticeLibrary,
  sharePractice,
} from '../src/lib/practice-library';
import { serialise, parseBackup, importBackup } from '../src/lib/backup';
import { categoryExport } from '../src/lib/category-backup';
import { ensureSystemHomePage, setSystemEnabled } from '../src/lib/workspace';
import { requiredSystems } from '../src/lib/widget-registry';
import { exportLayout, parseLayout } from '../src/lib/layout-sharing';
import { systemHomePage, WorkspaceSchema } from '../src/lib/workspace-model';
import { combinedWeek } from '../src/lib/week-planner';
let db: TrainingDB;
beforeEach(async () => {
  db = new TrainingDB('practice-' + crypto.randomUUID());
  await db.open();
});
afterEach(async () => {
  await db.delete();
});
async function sample() {
  await changePractice('rocket-league', (p) => Object.assign(p, rocketLeagueStarters()), db);
  const id = await startPractice('rocket-league', 'rl-warmup-5', db);
  return (await db.practice.get('rocket-league'))!.sessions.find((s) => s.id === id)!;
}
describe('practice persistence and timer', () => {
  it('starts empty and off, preserves other systems and enables its independent home and layout widgets', async () => {
    const before = await readData(db);
    expect(before.practice).toEqual([]);
    expect(before.workspace!.systems['rocket-league']).toBe(false);
    expect(before.workspace!.systems.football).toBe(false);
    await setSystemEnabled('rocket-league', true, db);
    await ensureSystemHomePage('rocket-league', db);
    const data = await readData(db);
    expect(data.workspace!.systems.gym).toBe(before.workspace!.systems.gym);
    const page = data.workspace!.pages.find((p) => p.id === 'rocket-league-home')!;
    expect(page.widgets).toHaveLength(4);
    expect(requiredSystems(page.widgets[0])).toEqual(['rocket-league']);
    expect(parseLayout(exportLayout(page, data)).page.widgets).toHaveLength(4);
    await setSystemEnabled('rocket-league', false, db);
    expect((await readData(db)).workspace!.pages).toContainEqual(page);
  });
  it('keeps routine snapshots, timer deadlines and paused time across a database reopen', async () => {
    let s = await sample();
    const start = s.timer.runningSince!;
    await changePractice(
      'rocket-league',
      (p) => {
        p.drills[0].name = 'Changed';
        p.routines[0].blocks[0].seconds = 900;
      },
      db,
    );
    db.close();
    await db.open();
    s = (await db.practice.get('rocket-league'))!.sessions[0];
    expect(s.entries[0].drill.name).toBe('Ball control');
    expect(s.entries[0].block.seconds).toBe(100);
    expect(timerSeconds(s, start + 15000)).toBe(15);
    await practiceCommand(
      'rocket-league',
      s.id,
      s.entries[0].id,
      'pause',
      undefined,
      db,
      start + 15000,
    );
    s = (await db.practice.get('rocket-league'))!.sessions[0];
    expect(timerSeconds(s, start + 99000)).toBe(15);
    await practiceCommand(
      'rocket-league',
      s.id,
      s.entries[0].id,
      'resume',
      undefined,
      db,
      start + 100000,
    );
    s = (await db.practice.get('rocket-league'))!.sessions[0];
    expect(timerSeconds(s, start + 105000)).toBe(20);
    await expect(startPractice('rocket-league', 'rl-warmup-5', db)).rejects.toThrow('Resume');
  });
  it('records once, supports rest, repeat, skip and quick completion without fabricating scores', async () => {
    const s = await sample();
    const entry = s.entries[0];
    const at = s.timer.runningSince! + 5000;
    await practiceCommand('rocket-league', s.id, entry.id, 'complete', undefined, db, at);
    await expect(
      practiceCommand('rocket-league', s.id, entry.id, 'complete', undefined, db, at),
    ).rejects.toThrow('already recorded');
    await practiceCommand('rocket-league', s.id, entry.id, 'repeat', undefined, db, at);
    let current = (await db.practice.get('rocket-league'))!.sessions[0];
    expect(current.cursor).toBe(1);
    expect(current.entries).toHaveLength(4);
    expect(current.entries[0].elapsedSeconds).toBe(5);
    expect(current.entries[0].result?.attempts).toBeUndefined();
    await practiceCommand(
      'rocket-league',
      s.id,
      current.entries[1].id,
      'skip',
      undefined,
      db,
      at + 1000,
    );
    await practiceCommand(
      'rocket-league',
      s.id,
      current.entries[1].id,
      'finish',
      undefined,
      db,
      at + 2000,
    );
    current = (await db.practice.get('rocket-league'))!.sessions[0];
    expect(current.status).toBe('completed');
    expect(current.entries.filter((e) => e.status === 'skipped')).toHaveLength(3);
    const undo = await deletePracticeSession('rocket-league', s.id, db);
    expect((await db.practice.get('rocket-league'))!.sessions).toEqual([]);
    await undo();
    expect((await db.practice.get('rocket-league'))!.sessions).toEqual([current]);
  });
  it('rejects stale edits, stale block commands and invalid hit counts atomically', async () => {
    const s = await sample();
    const p = (await db.practice.get('rocket-league'))!;
    await changePractice(
      'rocket-league',
      (p) => {
        p.focus = 'Other tab';
      },
      db,
    );
    await expect(savePracticeLibrary(p.id, p, p.revision, db)).rejects.toThrow('another tab');
    await expect(practiceCommand(p.id, s.id, 'stale-id', 'skip', undefined, db)).rejects.toThrow(
      'another tab',
    );
    await expect(
      practiceCommand(
        p.id,
        s.id,
        s.entries[0].id,
        'complete',
        { attempts: 1, hits: 2, notes: '', shots: [] },
        db,
      ),
    ).rejects.toThrow();
    expect((await db.practice.get(p.id))!.sessions[0].entries[0].status).toBe('pending');
  });
});
describe('practice portability and meaningful comparisons', () => {
  it('shares dependencies only, imports idempotently and never schedules a friend’s routine automatically', async () => {
    await sample();
    const p = (await db.practice.get('rocket-league'))!;
    p.routines[0].weekdays = [2];
    p.focus = 'Private';
    const file = parsePracticeLibrary(sharePractice(p, [p.routines[0].id]));
    expect(file.drills).toHaveLength(3);
    expect(JSON.stringify(file)).not.toContain('Private');
    expect(file).not.toHaveProperty('sessions');
    await importPracticeLibrary(file, 'rocket-league', db);
    await importPracticeLibrary(file, 'rocket-league', db);
    const after = (await db.practice.get(p.id))!;
    expect(after.routines).toHaveLength(p.routines.length + 1);
    expect(after.routines.at(-1)!.weekdays).toEqual([]);
    await expect(importPracticeLibrary(file, 'football', db)).rejects.toThrow('other practice');
    expect(() => parsePracticeLibrary(JSON.stringify({ ...file, sessions: [] }))).toThrow();
    expect(() => parsePracticeLibrary(JSON.stringify({ ...file, drills: [] }))).toThrow();
  });
  it('round trips backups and restores schema 5 without changing old gym, climbing, food or preferences', async () => {
    await sample();
    const data = await readData(db);
    const backup = parseBackup(serialise(data));
    expect(backup.schemaVersion).toBe(6);
    expect(backup.data.practice).toEqual(data.practice);
    await importBackup(backup, 'replace', db);
    expect((await readData(db)).practice).toEqual(data.practice);
    const legacy = JSON.parse(serialise(data));
    legacy.schemaVersion = 5;
    legacy.manifest.version = 5;
    delete legacy.data.practice;
    delete legacy.data.workspace.systems.football;
    delete legacy.data.workspace.systems['rocket-league'];
    const old = parseBackup(JSON.stringify(legacy));
    expect(old.data.practice).toEqual([]);
    expect(old.data.sessions).toEqual(data.sessions);
    expect(old.data.food).toEqual(data.food);
    expect(old.data.climbing).toEqual(data.climbing);
    expect(old.data.workspace!.systems.football).toBe(false);
  });
  it('exports selected practice data only and rolls back an active-session merge conflict with its recovery record', async () => {
    await sample();
    const data = await readData(db);
    const category = parseBackup(categoryExport(data, ['rocket-league']));
    expect(category.data.practice).toEqual(data.practice);
    expect(category.data.exercises).toEqual([]);
    expect(category.data.workspace).toBeUndefined();
    expect(category.data.food.foodEntries).toEqual([]);
    const incoming = parseBackup(serialise(data));
    incoming.data.practice[0].sessions[0].id = 'different-session';
    const count = await db.backups.count();
    await expect(importBackup(incoming, 'merge', db)).rejects.toThrow('active');
    expect(await db.backups.count()).toBe(count);
    expect((await readData(db)).practice).toEqual(data.practice);
  });
  it('separates feet and setups, handles zero/missing results and keeps recurring plans honest', async () => {
    const s = await sample();
    const d = s.entries[0].drill;
    expect(comparisonKey(d)).not.toBe(comparisonKey({ ...d, setup: 'New distance' }));
    expect(comparisonKey(d)).not.toBe(comparisonKey({ ...d, foot: 'left' }));
    const e = {
      ...s.entries[0],
      status: 'completed' as const,
      drill: { ...d, metric: 'accuracy' as const },
    };
    expect(resultValue(e)).toBeUndefined();
    expect(resultValue({ ...e, result: { attempts: 10, hits: 0, notes: '', shots: [] } })).toBe(0);
    expect(
      resultValue({ ...e, result: { attempts: 0, hits: 0, notes: '', shots: [] } }),
    ).toBeUndefined();
    await changePractice(
      'rocket-league',
      (p) => {
        p.routines[0].weekdays = [2];
      },
      db,
    );
    await setSystemEnabled('rocket-league', true, db);
    let week = combinedWeek(await readData(db), '2026-10-20');
    expect(week.find((w) => w.day === '2026-10-20')!.practice[0].routines).toHaveLength(1);
    await setSystemEnabled('rocket-league', false, db);
    week = combinedWeek(await readData(db), '2026-10-20');
    expect(week.every((w) => !w.practice.length)).toBe(true);
    expect(
      PracticeRowsSchema.safeParse([emptyPractice('football'), emptyPractice('football')]).success,
    ).toBe(false);
    expect(
      PracticeDataSchema.safeParse({
        ...emptyPractice('football'),
        drills: [DrillSchema.parse({ id: 'd', name: 'a', category: 'a', metric: 'time' })],
        routines: [{ id: 'r', name: 'a', blocks: [{ id: 'b', drillId: 'missing', sets: 1 }] }],
      }).success,
    ).toBe(false);
    expect(WorkspaceSchema.parse({ ...(await readData(db)).workspace }).systems.football).toBe(
      false,
    );
    expect(practiceData({}, 'football').sessions).toEqual([]);
  });
});

describe('starter routine additions', () => {
  it.each(['rocket-league', 'football'] as const)(
    'adds the %s catalogue once while preserving edited starters, custom content and active history',
    async (system) => {
      const starters = system === 'football' ? footballStarters() : rocketLeagueStarters();
      expect(starters.routines).toHaveLength(9);
      expect(new Set(starters.routines.map((r) => r.name)).size).toBe(9);
      expect(starters.routines.every((r) => r.weekdays.length === 0)).toBe(true);
      expect(starters.drills.every((d) => d.cue.length > 0 && !d.packCode && !d.link)).toBe(true);
      // Model an existing user with the original three templates, personal edits and a session.
      await changePractice(
        system,
        (p) => {
          p.drills = starters.drills.slice(0, 5);
          p.routines = starters.routines.slice(0, 3);
          p.drills[0].name = 'My own control drill';
          p.drills[0].setup = 'My saved setup';
          p.drills[0].archived = true;
          p.routines[0].name = 'My own warm-up';
          p.routines[0].blocks[0].seconds = 45;
          p.routines[0].weekdays = [2, 4];
          p.routines.push({ ...structuredClone(p.routines[0]), id: 'my-routine', name: 'Custom' });
          p.goal = 4;
          p.focus = 'My own focus';
        },
        db,
      );
      await startPractice(system, starters.routines[0].id, db);
      const before = await readData(db);
      const original = (await db.practice.get(system))!;
      const added = await addPracticeStarters(system, db);
      expect(added.routines).toHaveLength(10);
      expect(added.drills.slice(0, 5)).toEqual(original.drills);
      expect(added.routines.slice(0, 4)).toEqual(original.routines);
      expect(added.sessions).toEqual(original.sessions);
      expect(added.goal).toBe(4);
      expect(added.focus).toBe('My own focus');
      expect(added.routines.slice(4).every((r) => !r.weekdays.length)).toBe(true);
      expect(PracticeDataSchema.safeParse(added).success).toBe(true);
      const repeated = await addPracticeStarters(system, db);
      expect({ ...repeated, revision: added.revision }).toEqual(added);
      const after = await readData(db);
      expect({ ...after, practice: [] }).toEqual({ ...before, practice: [] });
    },
  );
});

describe('football', () => {
  it('keeps football history independent, shares its course snapshots, validates shots and records typical streaks', async () => {
    const { footballStarters } = await import('../src/lib/practice-library');
    const { typicalStreak, PracticeResultSchema } = await import('../src/lib/practice-model');
    await sample();
    await changePractice('football', (p) => Object.assign(p, footballStarters()), db);
    const id = await startPractice('football', 'fb-control', db);
    const s = (await db.practice.get('football'))!.sessions[0];
    await practiceCommand(
      'football',
      id,
      s.entries[0].id,
      'complete',
      { tries: [8, 12, 7, 15], best: 15, notes: 'Stable', shots: [] },
      db,
    );
    await practiceCommand('football', id, s.entries[0].id, 'finish', undefined, db);
    const p = (await db.practice.get('football'))!;
    expect(typicalStreak(p.sessions[0].entries)).toEqual({ median: 10, attempts: 4, best: 15 });
    expect((await db.practice.get('rocket-league'))!.sessions[0].status).toBe('active');
    const file = parsePracticeLibrary(sharePractice(p, ['fb-dribbling']));
    expect(file.drills.find((d) => d.id === 'fb-slalom')!.cones).toHaveLength(5);
    expect(() =>
      PracticeResultSchema.parse({ shots: [{ zone: 1, hit: true }], attempts: 2, hits: 0 }),
    ).toThrow('Target map counts');
    expect(() => PracticeResultSchema.parse({ tries: [7, 9], best: 12 })).toThrow('Best streak');
    expect(
      resultValue({
        ...p.sessions[0].entries[0],
        drill: { ...p.drills[0], metric: 'accuracy' },
        result: PracticeResultSchema.parse({ attempts: 5 }),
      }),
    ).toBeUndefined();
    await setSystemEnabled('football', true, db);
    await ensureSystemHomePage('football', db);
    const data = await readData(db);
    expect(requiredSystems(systemHomePage('football').widgets[0])).toEqual(['football']);
    expect(
      parseLayout(exportLayout(systemHomePage('football'), data)).page.widgets[0].requiredSystems,
    ).toEqual(['football']);
    const category = parseBackup(categoryExport(data, ['football']));
    expect(category.data.practice).toHaveLength(1);
    expect(category.data.practice[0].id).toBe('football');
    expect(weeklyReview(data).practice.find((p) => p.id === 'football')?.sessions).toBe(1);
  });
});

it('upgrades a version 5 database while preserving existing preferences and climbing goals', async () => {
  const name = 'practice-v5-' + crypto.randomUUID();
  const old = new Dexie(name);
  old.version(5).stores({ climbing: 'id', workspaces: 'id', settings: 'id' });
  await old.open();
  const before = await readData(db);
  await old.table('workspaces').put(before.workspace!);
  await old.table('settings').put({ ...before.settings, theme: 'dark' });
  await old.table('climbing').put(before.climbing!);
  old.close();
  const upgraded = new TrainingDB(name);
  try {
    await upgraded.open();
    expect(await upgraded.practice.count()).toBe(0);
    expect((await readData(upgraded)).settings.theme).toBe('dark');
    expect((await readData(upgraded)).climbing).toEqual(before.climbing);
    expect((await readData(upgraded)).workspace).toEqual(before.workspace);
  } finally {
    await upgraded.delete();
  }
});
