import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createJackDemo, demoId } from '../src/lib/demo-data';
import { loadJackDemo, removeJackDemo, isDemo } from '../src/lib/demo';
import { TrainingDB, readData } from '../src/lib/db';
import { parseBackup, serialise } from '../src/lib/backup';
import { dailyMacros } from '../src/lib/food-calc';
import { saveProfile } from '../src/lib/profile';
import { startSession } from '../src/lib/actions';

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
  expect(await loadJackDemo(database, today)).toBe(true);
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
