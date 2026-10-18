import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import { uid } from '../src/lib/model';
import {
  buildTrainingPlan,
  saveTrainingPlan,
  defaultDays,
  validSplits,
  PlanChoicesSchema,
} from '../src/lib/training-plan';
import { changeWorkspace } from '../src/lib/workspace';
let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('training-plan-' + uid());
  await database.open();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});
it('generates every supported schedule with valid library exercises, no prescribed loads and no writes during preview', async () => {
  const data = await readData(database);
  const original = await database.routines.count();
  for (let days = 1; days <= 6; days++)
    for (const split of validSplits(days)) {
      const plan = buildTrainingPlan(
        { days, split, experience: 'beginner', weekdays: defaultDays(days) },
        data,
      );
      expect(plan.routines).toHaveLength(days);
      expect(plan.routines.map((r) => r.weekdays[0])).toEqual(defaultDays(days));
      expect(
        plan.routines.every((r) =>
          r.items.every(
            (i) =>
              data.exercises.some((e) => e.id === i.exerciseId) &&
              i.sets.length === 2 &&
              i.sets.every((s) => s.loadKg === undefined),
          ),
        ),
      ).toBe(true);
    }
  expect(await database.routines.count()).toBe(original);
  expect(
    PlanChoicesSchema.safeParse({
      days: 4,
      split: 'push_pull_legs',
      experience: 'beginner',
      weekdays: [1, 2, 3, 4],
    }).success,
  ).toBe(false);
  expect(
    PlanChoicesSchema.safeParse({
      days: 3,
      split: 'full_body',
      experience: 'beginner',
      weekdays: [1, 1, 2],
    }).success,
  ).toBe(false);
});
it('adds a reviewed programme once, preserving existing routines and active sessions', async () => {
  const before = await readData(database);
  // Existing version-4 installations predate the optional plan save ledger.
  await database.workspaces.update('workspace', { planBuilds: undefined as never });
  const plan = buildTrainingPlan(
    { days: 3, split: 'full_body', experience: 'regular', weekdays: [1, 3, 5] },
    before,
  );
  const results = await Promise.all([
    saveTrainingPlan(plan, database),
    saveTrainingPlan(plan, database),
  ]);
  expect(results.filter((r) => r.alreadySaved)).toHaveLength(1);
  const after = await readData(database);
  expect(after.routines).toHaveLength(before.routines.length + 3);
  for (const routine of before.routines)
    expect(after.routines.find((r) => r.id === routine.id)).toEqual(routine);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.sets).toEqual(before.sets);
  expect(after.workspace!.planBuilds).toContain(plan.id);
});
it('rolls back every write on storage failure and rejects stale or disabled previews', async () => {
  const plan = buildTrainingPlan(
    { days: 2, split: 'upper_lower', experience: 'beginner', weekdays: [1, 4] },
    await readData(database),
  );
  const count = await database.routines.count();
  vi.spyOn(database.workspaces, 'put').mockRejectedValueOnce(new Error('Storage full'));
  await expect(saveTrainingPlan(plan, database)).rejects.toThrow('Storage full');
  expect(await database.routines.count()).toBe(count);
  expect(await database.programmes.get(plan.programme.id)).toBeUndefined();
  const exerciseId = plan.routines[0].items[0].exerciseId;
  await database.exercises.update(exerciseId, { archived: true });
  await expect(saveTrainingPlan(plan, database)).rejects.toThrow('changed in your library');
  await changeWorkspace((w) => {
    w.systems.gym = false;
  }, database);
  await expect(saveTrainingPlan(plan, database)).rejects.toThrow('Enable Gym');
  expect(await database.routines.count()).toBe(count);
});
