import { dateKey } from './calc';
import { foodDay, weekDays } from './food-calc';
import { emptyClimbing } from './climbing-model';
import { defaultWorkspace } from './workspace-model';
import { db, type TrainingDB } from './db';
import { PlanSchema, type Data, type Plan } from './model';

/** Dated copies take precedence over the recurring routine on that day. */
export function combinedWeek(data: Data, date = foodDay()) {
  const systems = (data.workspace ?? defaultWorkspace()).systems;
  const climbing = data.climbing ?? emptyClimbing;
  return weekDays(date).map((day) => {
    const plans = systems.gym ? data.plans.filter((p) => p.date === day) : [];
    const workouts = systems.gym
      ? data.sessions.filter((s) => s.status === 'completed' && dateKey(s.startAt) === day)
      : [];
    const routines =
      systems.gym && !plans.some((p) => p.status === 'rest')
        ? data.routines.filter(
            (r) =>
              r.weekdays.includes(new Date(day + 'T12:00:00').getDay()) &&
              !plans.some((p) => p.routineId === r.id) &&
              !workouts.some((s) => s.routineId === r.id),
          )
        : [];
    const climbs = systems.climbing
      ? climbing.sessions.filter((s) => s.status === 'completed' && s.date === day)
      : [];
    return {
      day,
      plans,
      workouts,
      routines,
      climbs,
      climbingPlans: systems.climbing
        ? climbing.plans.filter(
            (p) =>
              p.date === day &&
              !climbing.sessions.some((s) => s.status === 'completed' && s.planId === p.id),
          )
        : [],
      meals: systems.food ? (data.food?.mealPlans ?? []).filter((p) => p.date === day) : [],
      foodEntries: systems.food ? (data.food?.foodEntries ?? []).filter((e) => e.date === day) : [],
    };
  });
}
/** Compare the whole saved plan so another tab cannot be overwritten by a stale editor. */
export async function saveWeekGymPlan(value: Plan, expected?: Plan, database: TrainingDB = db) {
  const valid = PlanSchema.parse(value);
  await database.transaction('rw', database.plans, async () => {
    const current = await database.plans.get(value.id);
    if (JSON.stringify(current) !== JSON.stringify(expected))
      throw Error('This plan changed in another tab. Reopen it before saving.');
    if (current?.status === 'started')
      throw Error('A started plan cannot be moved. Edit its workout in history.');
    await database.plans.put(valid);
  });
}
export async function deleteWeekGymPlan(expected: Plan, database: TrainingDB = db) {
  await database.transaction('rw', database.plans, async () => {
    const current = await database.plans.get(expected.id);
    if (JSON.stringify(current) !== JSON.stringify(expected))
      throw Error('This plan changed in another tab.');
    if (current?.status === 'started') throw Error('A started plan cannot be removed here.');
    await database.plans.delete(expected.id);
  });
}
