import { describe, it, expect } from 'vitest';
import { fixture } from './fixtures';
import { workoutStreak } from '../src/lib/streak';

const at = (day: string) => new Date(day + 'T14:00:00').getTime();
function history(...days: string[]) {
  const data = fixture();
  const session = data.sessions[0];
  const set = data.sets[0];
  data.sessions = days.map((day, i) => ({
    ...session,
    id: `s${i}`,
    startAt: new Date(day + 'T12:00:00').toISOString(),
    endAt: new Date(day + 'T13:00:00').toISOString(),
  }));
  data.sets = data.sessions.map((session, i) => ({
    ...set,
    id: `set${i}`,
    sessionId: session.id,
    completedAt: session.endAt,
  }));
  return data;
}

describe('workout streaks with earned rest days', () => {
  it('starts empty without inventing a streak or an available rest bank', () => {
    const streak = workoutStreak(history(), at('2026-10-15'));
    expect(streak).toMatchObject({ current: 0, longest: 0, restDaysLeft: 0, earnedToday: 0 });
    expect(streak.days.size).toBe(0);
  });
  it('counts a finished workout with a completed set and starts with five rest days', () => {
    const streak = workoutStreak(history('2026-10-15'), at('2026-10-15'));
    expect(streak).toMatchObject({ current: 1, longest: 1, restDaysLeft: 5, earnedToday: 0 });
    expect(streak.days.get('2026-10-15')).toMatchObject({ kind: 'workout', workouts: 1 });
  });
  it('excludes active, cancelled, empty, incomplete and future training', () => {
    for (const status of ['active', 'cancelled'] as const) {
      const data = history('2026-10-15');
      data.sessions[0].status = status;
      expect(workoutStreak(data, at('2026-10-15')).current).toBe(0);
    }
    const data = history('2026-10-15');
    data.sets[0].completed = false;
    expect(workoutStreak(data, at('2026-10-15')).current).toBe(0);
    data.sets = [];
    expect(workoutStreak(data, at('2026-10-15')).current).toBe(0);
    expect(workoutStreak(history('2026-10-16'), at('2026-10-15')).current).toBe(0);
    const future = history('2026-10-15');
    future.sessions[0].endAt = new Date('2026-10-15T22:00:00').toISOString();
    expect(workoutStreak(future, at('2026-10-15')).current).toBe(0);
    future.sessions[0].endAt = undefined;
    future.sets[0].completedAt = new Date('2026-10-15T22:00:00').toISOString();
    expect(workoutStreak(future, at('2026-10-15')).current).toBe(0);
  });
  it('counts multiple same-day workouts once and never earns extra same-day credit', () => {
    const streak = workoutStreak(
      history('2026-10-14', '2026-10-15', '2026-10-15'),
      at('2026-10-15'),
    );
    expect(streak).toMatchObject({ current: 2, restDaysLeft: 6, earnedToday: 1 });
    expect(streak.days.get('2026-10-15')?.workouts).toBe(2);
  });
  it('uses a rest day only after the day has ended', () => {
    const data = history('2026-10-15');
    expect(workoutStreak(data, at('2026-10-16')).restDaysLeft).toBe(5);
    const next = workoutStreak(data, at('2026-10-17'));
    expect(next).toMatchObject({ current: 1, restDaysLeft: 4 });
    expect(next.days.get('2026-10-16')?.kind).toBe('rest');
    expect(next.days.has('2026-10-17')).toBe(false);
  });
  it('bridges rest days without adding them to the workout-day count', () => {
    const streak = workoutStreak(history('2026-10-10', '2026-10-13'), at('2026-10-13'));
    expect(streak).toMatchObject({ current: 2, longest: 2, restDaysLeft: 4, earnedToday: 1 });
    expect(streak.days.get('2026-10-11')).toMatchObject({ kind: 'rest', streakId: '2026-10-10' });
    expect(streak.days.get('2026-10-12')?.kind).toBe('rest');
  });
  it('allows training on the last unprotected day, then expires at midnight', () => {
    const data = history('2026-10-10');
    expect(workoutStreak(data, at('2026-10-16'))).toMatchObject({ current: 1, restDaysLeft: 0 });
    expect(workoutStreak(data, at('2026-10-17'))).toMatchObject({
      current: 0,
      longest: 1,
      restDaysLeft: 0,
    });
    expect(workoutStreak(history('2026-10-10', '2026-10-16'), at('2026-10-16'))).toMatchObject({
      current: 2,
      restDaysLeft: 1,
    });
  });
  it('caps the rest bank at seven and reports only credit actually added today', () => {
    const streak = workoutStreak(
      history('2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'),
      at('2026-10-13'),
    );
    expect(streak).toMatchObject({ current: 4, restDaysLeft: 7, earnedToday: 0 });
  });
  it('restarts after an uncovered day while preserving the longest streak and its calendar', () => {
    const streak = workoutStreak(
      history('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-12'),
      at('2026-10-12'),
    );
    expect(streak).toMatchObject({ current: 1, longest: 3, restDaysLeft: 5 });
    expect(streak.days.get('2026-10-10')?.kind).toBe('rest');
    expect(streak.days.has('2026-10-11')).toBe(false);
    expect(streak.days.get('2026-10-12')?.streakId).toBe('2026-10-12');
  });
  it('recalculates after deleting or correcting historical workouts without mutating data', () => {
    const data = history('2026-10-10', '2026-10-12', '2026-10-14');
    const before = JSON.stringify(data);
    expect(workoutStreak(data, at('2026-10-14')).current).toBe(3);
    expect(JSON.stringify(data)).toBe(before);
    data.sessions.splice(1, 1);
    const streak = workoutStreak(data, at('2026-10-14'));
    expect(streak).toMatchObject({ current: 2, restDaysLeft: 3 });
    expect(streak.days.get('2026-10-12')?.kind).toBe('rest');
    data.sessions[1].startAt = new Date('2026-10-13T12:00:00').toISOString();
    expect(workoutStreak(data, at('2026-10-14')).days.get('2026-10-13')?.kind).toBe('workout');
  });
  it('bridges month, year and leap-day boundaries by calendar dates', () => {
    const leap = workoutStreak(history('2024-02-28', '2024-03-01'), at('2024-03-01'));
    expect(leap).toMatchObject({ current: 2, restDaysLeft: 5 });
    expect(leap.days.get('2024-02-29')?.kind).toBe('rest');
    const year = workoutStreak(history('2025-12-31', '2026-01-02'), at('2026-01-02'));
    expect(year).toMatchObject({ current: 2, restDaysLeft: 5 });
    expect(year.days.get('2026-01-01')?.kind).toBe('rest');
  });
  it('handles both daylight-saving transitions in the browser timezone', () => {
    const original = process.env.TZ;
    process.env.TZ = 'Europe/London';
    try {
      for (const [first, second, middle] of [
        ['2026-03-28', '2026-03-30', '2026-03-29'],
        ['2026-10-24', '2026-10-26', '2026-10-25'],
      ]) {
        const streak = workoutStreak(history(first, second), at(second));
        expect(streak).toMatchObject({ current: 2, restDaysLeft: 5 });
        expect(streak.days.get(middle)?.kind).toBe('rest');
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
  it('uses the local start day for a workout that finishes after midnight', () => {
    const data = history('2026-10-15');
    data.sessions[0].startAt = new Date('2026-10-15T23:50:00').toISOString();
    data.sessions[0].endAt = new Date('2026-10-16T00:20:00').toISOString();
    data.sets[0].completedAt = data.sessions[0].endAt;
    const streak = workoutStreak(data, at('2026-10-16'));
    expect(streak).toMatchObject({ current: 1, restDaysLeft: 5 });
    expect(streak.days.get('2026-10-15')?.kind).toBe('workout');
    expect(streak.days.has('2026-10-16')).toBe(false);
  });
});
