import { dateKey } from './calc';
import type { Data } from './model';

export const STREAK_RULES = { startingRestDays: 5, earnedPerWorkoutDay: 1, maxRestDays: 7 };

export type StreakDay = {
  kind: 'workout' | 'rest';
  streakId: string;
  workouts: number;
  earned: number;
};

export type WorkoutStreak = {
  current: number;
  longest: number;
  restDaysLeft: number;
  earnedToday: number;
  today: string;
  currentStart?: string;
  latestWorkout?: string;
  days: Map<string, StreakDay>;
};

// Calendar ordinals preserve local dates across 23/25-hour daylight-saving days.
const dayNumber = (date: Date) =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
const keyForDay = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);

export function workoutStreak(data: Data, at = Date.now()): WorkoutStreak {
  const today = dateKey(new Date(at));
  const result: WorkoutStreak = {
    current: 0,
    longest: 0,
    restDaysLeft: 0,
    earnedToday: 0,
    today,
    days: new Map(),
  };
  const completed = new Set(
    data.sets
      .filter((set) => set.completed && (!set.completedAt || Date.parse(set.completedAt) <= at))
      .map((set) => set.sessionId),
  );
  const trainingDays = new Map<number, number>();
  for (const session of data.sessions) {
    if (
      session.status !== 'completed' ||
      !completed.has(session.id) ||
      Date.parse(session.startAt) > at ||
      (session.endAt && Date.parse(session.endAt) > at)
    )
      continue;
    const day = dayNumber(new Date(session.startAt));
    trainingDays.set(day, (trainingDays.get(day) || 0) + 1);
  }
  let lastDay: number | undefined;
  let streakId = '';
  let count = 0;
  let rest = 0;
  const protectDays = (after: number, number: number) => {
    for (let i = 1; i <= number; i++) {
      result.days.set(keyForDay(after + i), {
        kind: 'rest',
        streakId,
        workouts: 0,
        earned: 0,
      });
    }
  };
  for (const [day, workouts] of [...trainingDays].sort(([a], [b]) => a - b)) {
    const gap = lastDay === undefined ? 0 : day - lastDay - 1;
    if (lastDay !== undefined) protectDays(lastDay, Math.min(gap, rest));
    let earned = 0;
    if (lastDay === undefined || gap > rest) {
      streakId = keyForDay(day);
      count = 1;
      rest = STREAK_RULES.startingRestDays;
    } else {
      rest -= gap;
      earned = Math.min(STREAK_RULES.earnedPerWorkoutDay, STREAK_RULES.maxRestDays - rest);
      rest += earned;
      count++;
    }
    result.days.set(keyForDay(day), { kind: 'workout', streakId, workouts, earned });
    result.longest = Math.max(result.longest, count);
    lastDay = day;
  }
  if (lastDay === undefined) return result;
  result.latestWorkout = keyForDay(lastDay);
  // Today stays open until local midnight: a workout today can still extend the streak.
  const elapsedRestDays = Math.max(0, dayNumber(new Date(at)) - lastDay - 1);
  protectDays(lastDay, Math.min(elapsedRestDays, rest));
  if (elapsedRestDays <= rest) {
    result.current = count;
    result.currentStart = streakId;
    result.restDaysLeft = rest - elapsedRestDays;
  }
  result.earnedToday = result.days.get(today)?.earned || 0;
  return result;
}
