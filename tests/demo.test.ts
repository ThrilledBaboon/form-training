import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createJackDemo, demoId } from '../src/lib/demo-data';
import { loadJackDemo, removeJackDemo, isDemo } from '../src/lib/demo';
import { TrainingDB, readData } from '../src/lib/db';
import { parseBackup, serialise } from '../src/lib/backup';
import { dailyMacros } from '../src/lib/food-calc';
import { saveProfile } from '../src/lib/profile';
import { startSession } from '../src/lib/actions';
import { emptyClimbing } from '../src/lib/climbing-model';
import { saveClimbingGoal } from '../src/lib/climbing-actions';

const today = '2026-10-18';
let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('demo-test-' + crypto.randomUUID());
  await database.open();
});
afterEach(async () => {
  await database.delete();
});

it('generates a valid, deterministic six-month backup with progression and linked food records', () => {
  const data = createJackDemo(today);
  expect(createJackDemo(today)).toEqual(data);
  expect(() => parseBackup(serialise(data))).not.toThrow();
  expect(data.sessions.length).toBeGreaterThan(90);
  expect(data.sets.length).toBeGreaterThan(1300);
  expect(data.bodyweights[0].at.slice(0, 10)).toBe('2026-04-18');
  expect(data.bodyweights.at(-1)!.at.slice(0, 10)).toBe(today);
  expect(data.bodyweights[0].kg).toBeGreaterThan(data.bodyweights.at(-1)!.kg);
  const bench = data.sets.filter((s) => s.exerciseId === 'exercise-barbell-bench-press');
  expect(bench.at(-1)!.loadKg).toBeGreaterThan(bench[0].loadKg!);
  expect(data.food!.foodEntries.length).toBeGreaterThan(700);
  expect(data.food!.purchases.length).toBeGreaterThan(25);
  expect(dailyMacros(data.food!, today).protein).toBeGreaterThan(90);
  expect(data.food!.foodSettings.showCalories).toBe(false);
  const climbing = data.climbing!;
  expect(climbing.sessions.length).toBeGreaterThan(40);
  expect(climbing.climbs.length).toBeGreaterThan(40);
  expect(new Set(climbing.sessions.map((s) => s.date.slice(0, 7))).size).toBe(7);
  expect(
    new Set(climbing.sessions.flatMap((s) => s.entries.map((e) => e.snapshot.type))).size,
  ).toBe(4);
  expect(
    new Set(climbing.sessions.flatMap((s) => s.entries.map((e) => e.snapshot.environment))).size,
  ).toBe(2);
  expect(new Set(climbing.sessions.flatMap((s) => s.entries.map((e) => e.result))).size).toBe(4);
  expect(climbing.sessions.every((s) => s.date >= '2026-04-18' && s.date <= today)).toBe(true);
  expect(climbing.sessions.some((s) => s.durationMinutes === undefined)).toBe(true);
  expect(climbing.climbs.some((c) => c.project === 'active')).toBe(true);
  expect(climbing.climbs.some((c) => c.project === 'completed')).toBe(true);
  expect(data.workspace!.pages.find((p) => p.id === demoId('climbing-page'))!.range).toEqual({
    days: 0,
    from: '2026-04-18',
    to: today,
  });
  for (const purchase of data.food!.purchases)
    expect(purchase.total).toBeCloseTo(
      purchase.lines.reduce((sum, l) => sum + l.paid, 0),
      2,
    );
  for (const session of data.sessions) {
    expect(session.startAt.slice(0, 10) <= today).toBe(true);
    expect(
      data.sets
        .filter((s) => s.sessionId === session.id)
        .every((s) => Date.parse(s.completedAt!) <= Date.parse(session.endAt!)),
    ).toBe(true);
  }
});

it('clamps month ends and spans daylight-saving changes without skipped or duplicate food days', () => {
  for (const [end, first, expected] of [
    ['2026-08-31', '2026-02-28', 185],
    ['2026-11-18', '2026-05-18', 185],
  ]) {
    const data = createJackDemo(end);
    const days = [...new Set(data.food!.foodEntries.map((e) => e.date))].sort();
    expect(days[0]).toBe(first);
    expect(days.at(-1)).toBe(end);
    expect(days).toHaveLength(expected);
    expect(() => parseBackup(serialise(data))).not.toThrow();
  }
});

it('adds wall tags once to unchanged older demo records, preserving real records, corrections, goals and dates', async () => {
  await loadJackDemo(database, today);
  const original = await readData(database);
  const old = structuredClone(original);
  old.climbing!.climbs.forEach((c) => delete c.wallStyle);
  old.climbing!.sessions.forEach((s) => s.entries.forEach((e) => delete e.snapshot.wallStyle));
  old.workspace!.pages.find((p) => p.id === demoId('climbing-page'))!.widgets = old
    .workspace!.pages.find((p) => p.id === demoId('climbing-page'))!
    .widgets.filter((w) => w.type !== 'climbing-wall-map');
  const seeded = (await database.backups.get(demoId('after')))!;
  await database.backups.put({ ...seeded, json: serialise(old) });
  const personal = { ...old.climbing!.climbs[0], id: 'my-real-climb', notes: 'My beta' };
  old.climbing!.climbs.push(personal);
  old.climbing!.climbs[0].notes = 'My corrected demo climb';
  old.climbing!.sessions[0].entries[0].snapshot.name = 'My corrected route snapshot';
  await database.climbing.put(old.climbing!);
  await database.workspaces.put(old.workspace!);
  await saveClimbingGoal(3, undefined, database);
  expect(await loadJackDemo(database, '2026-10-19')).toBe(true);
  const loaded = await readData(database);
  expect(loaded.climbing!.goal!.weeklySessions).toBe(3);
  expect(loaded.climbing!.climbs.find((c) => c.id === personal.id)).toEqual(personal);
  expect(loaded.climbing!.climbs[0].wallStyle).toBeUndefined();
  expect(loaded.climbing!.climbs[0].notes).toBe('My corrected demo climb');
  expect(loaded.climbing!.climbs[1].wallStyle).toBeDefined();
  expect(loaded.climbing!.sessions[0].entries[0].snapshot.wallStyle).toBeUndefined();
  expect(loaded.climbing!.sessions[1].entries[0].snapshot.wallStyle).toBeDefined();
  expect(loaded.climbing!.sessions.map((s) => s.date)).toEqual(
    old.climbing!.sessions.map((s) => s.date),
  );
  const page = loaded.workspace!.pages.find((p) => p.id === demoId('climbing-page'))!;
  expect(page.widgets.some((w) => w.type === 'climbing-wall-map')).toBe(true);
  expect(page.range).toEqual(old.workspace!.pages.find((p) => p.id === page.id)!.range);
  for (const key of ['sessions', 'sets', 'bodyweights', 'food'] as const)
    expect(loaded[key]).toEqual(original[key]);
  expect(await loadJackDemo(database, today)).toBe(false);
  expect(await readData(database)).toEqual(loaded);
  await removeJackDemo(database);
  expect((await readData(database)).climbing!.goal!.weeklySessions).toBe(3);
  expect((await readData(database)).climbing!.climbs).toEqual([personal]);
});

it('loads atomically, keeps existing data and preferences, and adds no duplicates on repeat', async () => {
  await saveProfile({ name: 'Existing Jack', heightCm: 181, initialWeightKg: 80 }, 77, database);
  await database.foodSettings.put({
    id: 'food-preferences',
    currency: 'GBP',
    targets: { protein: 130 },
    showCalories: true,
    weeklyBudget: 90,
    locations: ['Fridge'],
  });
  const before = await readData(database);
  expect(await loadJackDemo(database, today)).toBe(true);
  const loaded = await readData(database);
  expect(loaded.workspace!.profile).toEqual(before.workspace!.profile);
  expect(loaded.settings).toEqual(before.settings);
  expect(loaded.food!.foodSettings).toMatchObject(before.food!.foodSettings);
  expect(loaded.bodyweights).toEqual(expect.arrayContaining(before.bodyweights));
  expect(
    parseBackup((await database.backups.get(demoId('before')))!.json).data.bodyweights,
  ).toEqual(before.bodyweights);
  expect(await loadJackDemo(database, today)).toBe(false);
  expect(await readData(database)).toEqual(loaded);
  await removeJackDemo(database);
  const removed = await readData(database);
  expect(removed.sessions).toEqual(before.sessions);
  expect(removed.sets).toEqual(before.sets);
  expect(removed.bodyweights).toEqual(before.bodyweights);
  expect(removed.routines).toEqual(before.routines);
  expect(removed.workspace!.profile).toEqual(before.workspace!.profile);
  expect(removed.food!.foodSettings).toEqual(before.food!.foodSettings);
});

it('removes sample history while keeping new workouts, profile edits and sample recipes used by real entries', async () => {
  await loadJackDemo(database, today);
  await database.bodyweights.add({
    id: 'my-new-weight',
    at: '2026-10-19T07:00:00Z',
    kg: 79,
    notes: 'Real entry after demo',
  });
  const current = await readData(database);
  await saveProfile(
    { ...current.workspace!.profile!, name: 'My Jack', heightCm: 180 },
    76,
    database,
  );
  const active = await startSession(
    current.routines.find((r) => isDemo(r.id)),
    database,
  );
  const meal = current.food!.foodEntries[0];
  await database.foodEntries.add({ ...meal, id: 'my-new-meal', notes: 'My real meal' });
  await database.foodSettings.update('food-preferences', {
    targets: { protein: 180 },
    showCalories: true,
  });
  expect(await removeJackDemo(database)).toBeGreaterThan(0);
  const removed = await readData(database);
  expect(removed.bodyweights.map((b) => b.id)).toEqual(['my-new-weight']);
  expect(removed.sessions.map((s) => s.id)).toEqual([active]);
  expect(removed.workspace!.profile).toMatchObject({ name: 'My Jack', heightCm: 180 });
  expect(removed.settings.goalKg).toBe(76);
  expect(removed.food!.foodSettings).toMatchObject({
    showCalories: true,
    targets: { protein: 180 },
  });
  expect(removed.food!.foodEntries.map((e) => e.id)).toEqual(['my-new-meal']);
  expect(removed.food!.recipes.some((r) => r.id === meal.recipeId)).toBe(true);
  expect(removed.workspace!.pages.every((p) => !isDemo(p.id))).toBe(true);
  expect(() => parseBackup(serialise(removed))).not.toThrow();
});

it('returns a fresh database to its original records and allows loading again', async () => {
  const before = await readData(database);
  await loadJackDemo(database, today);
  expect(await removeJackDemo(database)).toBe(0);
  const after = await readData(database);
  expect(after.settings).toEqual(before.settings);
  expect(after.food).toEqual(before.food);
  expect(after.workspace!.profile).toEqual(before.workspace!.profile);
  expect(after.sessions).toEqual([]);
  expect(after.climbing!.sessions).toEqual([]);
  expect(after.climbing!.climbs).toEqual([]);
  expect(after.climbing!.plans).toEqual([]);
  expect(await loadJackDemo(database, today)).toBe(true);
});

async function legacyDemo() {
  await loadJackDemo(database, today);
  const current = await readData(database);
  const climb = { ...current.climbing!.climbs[0], id: 'my-own-climb', notes: 'Keep my beta' };
  await database.climbing.put({ ...emptyClimbing, climbs: [climb] });
  const workspace = current.workspace!;
  workspace.pages = workspace.pages.filter((p) => p.id !== demoId('climbing-page'));
  workspace.pages.find((p) => p.id === demoId('page'))!.name = 'My customised charts';
  await database.workspaces.put(workspace);
  await database.bodyweights.delete(current.bodyweights[0].id);
  const snapshot = (await database.backups.get(demoId('after')))!;
  const seeded = parseBackup(snapshot.json).data;
  seeded.climbing = structuredClone(emptyClimbing);
  seeded.workspace!.pages = seeded.workspace!.pages.filter((p) => p.id !== demoId('climbing-page'));
  await database.backups.put({ ...snapshot, json: serialise(seeded) });
  return readData(database);
}

it('extends an older Jack demo once without replacing records, preferences or customised pages', async () => {
  const before = await legacyDemo();
  expect(await loadJackDemo(database, today)).toBe(true);
  const loaded = await readData(database);
  expect(loaded.climbing!.climbs).toEqual(expect.arrayContaining(before.climbing!.climbs));
  expect(loaded.climbing!.sessions.length).toBeGreaterThan(40);
  for (const key of ['sessions', 'sets', 'bodyweights', 'food', 'settings'] as const)
    expect(loaded[key]).toEqual(before[key]);
  expect(loaded.workspace!.pages).toEqual(expect.arrayContaining(before.workspace!.pages));
  expect(loaded.workspace!.systems).toEqual(before.workspace!.systems);
  expect(await loadJackDemo(database, today)).toBe(false);
  expect(await readData(database)).toEqual(loaded);
  expect(() => parseBackup(serialise(loaded))).not.toThrow();
  await removeJackDemo(database);
  expect((await readData(database)).climbing!.climbs).toEqual(before.climbing!.climbs);
  expect((await readData(database)).climbing!.sessions).toEqual([]);
});

it('rolls back a failed older-demo extension together with its recovery snapshot', async () => {
  const before = await legacyDemo();
  const count = await database.backups.count();
  const spy = vi.spyOn(database.workspaces, 'put').mockRejectedValueOnce(Error('disk full'));
  await expect(loadJackDemo(database, today)).rejects.toThrow('disk full');
  spy.mockRestore();
  expect(await readData(database)).toEqual(before);
  expect(await database.backups.count()).toBe(count);
  expect(await loadJackDemo(database, today)).toBe(true);
});

it('keeps sample climbs and plans used by real climbing sessions when removing the demo', async () => {
  await loadJackDemo(database, today);
  const current = (await readData(database)).climbing!;
  const sample = current.sessions[0];
  const session = { ...sample, id: 'my-climbing-session', planId: current.plans[0].id };
  await database.climbing.put({ ...current, sessions: [...current.sessions, session] });
  expect(await removeJackDemo(database)).toBeGreaterThan(0);
  const removed = await readData(database);
  expect(removed.climbing!.sessions).toEqual([session]);
  expect(removed.climbing!.plans.map((p) => p.id)).toEqual([session.planId]);
  expect(removed.climbing!.climbs.map((c) => c.id).sort()).toEqual(
    [...new Set(session.entries.map((e) => e.climbId))].sort(),
  );
  expect(() => parseBackup(serialise(removed))).not.toThrow();
});

it('rolls back records and recovery markers if loading fails after the merge', async () => {
  const before = await readData(database);
  vi.spyOn(database.foodSettings, 'put').mockRejectedValueOnce(
    new Error('Simulated storage failure'),
  );
  await expect(loadJackDemo(database, today)).rejects.toThrow('Simulated storage failure');
  expect(await readData(database)).toEqual(before);
  expect(await database.backups.count()).toBe(0);
});
