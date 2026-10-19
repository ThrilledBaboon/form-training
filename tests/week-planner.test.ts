import { afterEach, beforeEach, expect, it } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import { uid } from '../src/lib/model';
import { combinedWeek, saveWeekGymPlan, deleteWeekGymPlan } from '../src/lib/week-planner';
import { defaultWorkspace } from '../src/lib/workspace-model';
let db: TrainingDB;
beforeEach(async () => {
  db = new TrainingDB('week-' + uid());
  await db.open();
});
afterEach(async () => {
  await db.delete();
});
it('places dated snapshots over recurring routines and leaves unrelated systems hidden', async () => {
  const data = await readData(db),
    r = data.routines[0];
  r.weekdays = [1];
  data.routines = [r];
  const monday = '2026-10-12';
  expect(combinedWeek(data, monday)[0].routines).toEqual([r]);
  data.plans = [
    {
      id: uid(),
      routineId: r.id,
      name: r.name,
      date: monday,
      status: 'planned',
      items: r.items,
      groups: r.groups,
      notes: '',
    },
  ];
  expect(combinedWeek(data, monday)[0].routines).toEqual([]);
  expect(combinedWeek(data, monday)[0].plans).toHaveLength(1);
  data.workspace = defaultWorkspace();
  data.workspace.systems.gym = false;
  expect(combinedWeek(data, monday)[0].plans).toEqual([]);
  expect(combinedWeek(data, monday)[0].routines).toEqual([]);
});
it('moves dated plans without changing routines and rejects stale or started editors', async () => {
  const data = await readData(db),
    r = data.routines[0];
  const plan = {
    id: uid(),
    routineId: r.id,
    name: r.name,
    date: '2026-10-12',
    status: 'planned' as const,
    items: r.items,
    groups: r.groups,
    notes: '',
  };
  await saveWeekGymPlan(plan, undefined, db);
  const changed = { ...plan, date: '2026-10-13' };
  await saveWeekGymPlan(changed, plan, db);
  await expect(saveWeekGymPlan(plan, plan, db)).rejects.toThrow('another tab');
  expect((await readData(db)).routines).toEqual(data.routines);
  await deleteWeekGymPlan(changed, db);
  expect(await db.plans.count()).toBe(0);
  await db.plans.add({ ...plan, status: 'started' });
  await expect(saveWeekGymPlan(changed, { ...plan, status: 'started' }, db)).rejects.toThrow(
    'started',
  );
});
