import { practiceSystems, practiceData } from './practice-model';
import type { Data } from './model';
import { dateKey, sessionStats } from './calc';
import { foodDay, weekDays, shiftDay, dailyMacros } from './food-calc';
import { emptyFood, macroKeys } from './food-model';
import { emptyClimbing } from './climbing-model';
import { defaultWorkspace } from './workspace-model';
export function weeklyReview(data: Data, date = foodDay()) {
  const [from, , , , , , through] = weekDays(date),
    to = through < foodDay() ? through : foodDay();
  const systems = (data.workspace ?? defaultWorkspace()).systems;
  const inside = (day: string) => day >= from && day <= to;
  const gym = systems.gym
    ? data.sessions.filter((s) => s.status === 'completed' && inside(dateKey(s.startAt)))
    : [];
  const climbing = systems.climbing
    ? (data.climbing ?? emptyClimbing).sessions.filter(
        (s) => s.status === 'completed' && inside(s.date),
      )
    : [];
  const food = data.food ?? emptyFood;
  const foodDates = systems.food
    ? [...new Set(food.foodEntries.filter((e) => inside(e.date)).map((e) => e.date))].sort()
    : [];
  const macros = Object.fromEntries(
    macroKeys.map((key) => {
      const values = foodDates
        .map((day) => dailyMacros(food, day)[key])
        .filter((v): v is number => v !== undefined);
      return [
        key,
        {
          average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined,
          knownDays: values.length,
          unknownDays: foodDates.length - values.length,
        },
      ];
    }),
  );
  const previousFrom = shiftDay(from, -7),
    previousTo = shiftDay(to, -7);
  const previousGym = systems.gym
    ? data.sessions.filter(
        (s) =>
          s.status === 'completed' &&
          dateKey(s.startAt) >= previousFrom &&
          dateKey(s.startAt) <= previousTo,
      ).length
    : 0;
  const previousClimbing = systems.climbing
    ? (data.climbing ?? emptyClimbing).sessions.filter(
        (s) => s.status === 'completed' && s.date >= previousFrom && s.date <= previousTo,
      ).length
    : 0;
  return {
    from,
    to,
    through,
    systems,
    practice: practiceSystems
      .filter((id) => systems[id])
      .map((id) => {
        const p = practiceData(data, id);
        const sessions = p.sessions.filter(
          (s) => s.status === 'completed' && inside(dateKey(s.startAt)),
        );
        return {
          id,
          sessions: sessions.length,
          minutes: sessions.reduce(
            (n, s) =>
              n +
              s.entries
                .filter((e) => e.status === 'completed')
                .reduce((n, e) => n + e.elapsedSeconds / 60, 0),
            0,
          ),
          previous: p.sessions.filter(
            (s) =>
              s.status === 'completed' &&
              dateKey(s.startAt) >= previousFrom &&
              dateKey(s.startAt) <= previousTo,
          ).length,
        };
      }),
    gym,
    climbing,
    foodDates,
    macros,
    recordedDays: weekDays(date).filter(inside).length,
    activityDays: new Set([...gym.map((s) => dateKey(s.startAt)), ...climbing.map((s) => s.date)])
      .size,
    gymSets: gym.reduce((n, s) => n + sessionStats(data, s).sets, 0),
    knownMinutes:
      gym.filter((s) => !s.dateOnly).reduce((n, s) => n + sessionStats(data, s).minutes, 0) +
      climbing.reduce((n, s) => n + (s.durationMinutes ?? 0), 0),
    unknownDurations:
      gym.filter((s) => s.dateOnly).length +
      climbing.filter((s) => s.durationMinutes === undefined).length,
    climbingAttempts: climbing.flatMap((s) => s.entries).reduce((n, e) => n + e.attempts, 0),
    climbingCompletions: climbing
      .flatMap((s) => s.entries)
      .filter((e) => e.result === 'completed' || e.result === 'flash').length,
    previousGym,
    previousClimbing,
  };
}
