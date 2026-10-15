import { describe, it, expect } from 'vitest';
import { fixture, t } from './fixtures';
import {
  fromKg,
  toKg,
  estimatedMax,
  externalVolume,
  setMagnitude,
  sessionStats,
  muscleContributions,
  heatColor,
  contributionColors,
  personalRecords,
  exerciseHistory,
  recommendation,
  calendarDays,
  dayStats,
  bodyweightTrend,
  compare,
  roundTo,
  dateKey,
} from '../src/lib/calc';
import { remainingMs } from '../src/components/Timer';
import { csv } from '../src/lib/backup';
describe('canonical measurements', () => {
  it('round-trips kg and lb without double conversion', () => {
    expect(fromKg(100, 'lb')).toBeCloseTo(220.462262);
    expect(toKg(fromKg(72.345, 'lb'), 'lb')).toBeCloseTo(72.345, 10);
    expect(toKg(100, 'kg')).toBe(100);
  });
  it('rounds to a configurable load increment', () => {
    expect(roundTo(72, 2.5)).toBe(72.5);
  });
  it('uses partial repetitions in volume', () => {
    const d = fixture();
    expect(externalVolume({ ...d.sets[0], reps: 8.5 }, 'weighted')).toBe(510);
  });
  it('excludes warm-ups, incomplete and incompatible tracking from external volume', () => {
    const s = fixture().sets[0];
    expect(externalVolume({ ...s, label: 'warmup' }, 'weighted')).toBe(0);
    expect(externalVolume({ ...s, completed: false }, 'weighted')).toBe(0);
    expect(externalVolume(s, 'assisted')).toBe(0);
    expect(externalVolume(s, 'bodyweight')).toBe(0);
  });
  it('uses saved system load only when enabled', () => {
    const s = { ...fixture().sets[0], loadKg: 20, bodyweightKg: 80, reps: 10 };
    expect(setMagnitude(s, { tracking: 'bodyweight', includeBodyweight: false })).toBe(10);
    expect(setMagnitude(s, { tracking: 'loaded_bodyweight', includeBodyweight: true })).toBe(1000);
    expect(setMagnitude(s, { tracking: 'assisted', includeBodyweight: true })).toBe(600);
  });
});
describe('estimated maximums', () => {
  it('implements Epley and Brzycki', () => {
    expect(estimatedMax(100, 5, 'epley')).toBeCloseTo(116.6667);
    expect(estimatedMax(100, 5, 'brzycki')).toBe(112.5);
  });
  it('returns actual load for a single repetition', () => {
    expect(estimatedMax(100, 1, 'epley')).toBe(100);
    expect(estimatedMax(100, 1, 'brzycki')).toBe(100);
  });
  it('withholds invalid and high-rep estimates', () => {
    for (const [load, reps] of [
      [0, 5],
      [100, 0],
      [100, 13],
      [100, 37],
      [-1, 5],
      [NaN, 5],
      [Infinity, 5],
    ])
      expect(estimatedMax(load, reps)).toBeUndefined();
  });
});
describe('history and records', () => {
  it('counts a set once even in a group', () => {
    const d = fixture();
    d.sessions[0].groups = [{ id: 'g', name: 'A', type: 'circuit', restSeconds: 60, notes: '' }];
    d.sessions[0].items[0].groupId = 'g';
    expect(sessionStats(d, d.sessions[0])).toMatchObject({
      sets: 1,
      volume: 720,
      reps: 12,
      minutes: 60,
    });
  });
  it('ignores incomplete and cancelled sessions', () => {
    const d = fixture();
    d.sessions[0].status = 'cancelled';
    expect(exerciseHistory(d, d.exercises[0].id)).toHaveLength(0);
    expect(personalRecords(d)).toHaveLength(0);
  });
  it('recalculates records after edits and deletions', () => {
    const d = fixture();
    expect(personalRecords(d).find((r) => r.kind === 'Heaviest load')?.value).toBe(60);
    d.sets[0].loadKg = 45;
    expect(personalRecords(d).find((r) => r.kind === 'Heaviest load')?.value).toBe(45);
    d.sets = [];
    expect(personalRecords(d)).toHaveLength(0);
  });
  it('never promotes warm-ups to working records', () => {
    const d = fixture();
    d.sets.push({ ...d.sets[0], id: 'warmup', loadKg: 200, label: 'warmup' });
    expect(personalRecords(d).find((r) => r.kind === 'Heaviest load')?.value).toBe(60);
  });
  it('shows a conservative suggestion only when all planned sets meet target', () => {
    const d = fixture();
    const e = d.exercises[0];
    expect(recommendation(d, e).increase).toBe(false);
    d.sets.push({ ...d.sets[0], id: '2', order: 1 }, { ...d.sets[0], id: '3', order: 2 });
    const result = recommendation(d, e);
    expect(result.increase).toBe(true);
    expect(result.loadKg).toBe(62.5);
    d.sets[0].rpe = 10;
    expect(recommendation(d, e).increase).toBe(false);
  });
  it('returns an honest insufficient-history recommendation', () => {
    const d = fixture();
    d.sets = [];
    expect(recommendation(d, d.exercises[0]).reason).toContain('No completed history');
  });
  it('compares load, repetitions, volume, sets and estimated maximum', () => {
    const d = fixture();
    const h = exerciseHistory(d, d.exercises[0].id)[0];
    expect(compare(h, { ...h, reps: 10, volume: 600, bestLoad: 50, bestMax: 70 })).toMatchObject({
      reps: 2,
      load: 10,
      volume: 120,
      sets: 0,
      volumePercent: 19.999999999999996,
    });
  });
});
describe('muscle accounting', () => {
  it('keeps primary and secondary contribution separate', () => {
    const d = fixture();
    const m = muscleContributions(d, 7, Date.parse(t) + 3600000);
    expect(m.find((x) => x.muscle === 'chest')?.sets).toBe(1);
    expect(m.find((x) => x.muscle === 'triceps')?.sets).toBe(0.5);
    expect(m.find((x) => x.muscle === 'chest')?.details).toHaveLength(1);
  });
  it('uses actual sets for relative scores and recovery decay', () => {
    const d = fixture();
    const at = Date.parse(d.sessions[0].endAt!);
    const m = muscleContributions(d, 7, at).find((x) => x.muscle === 'chest')!;
    expect(m.score).toBe(1);
    expect(m.recentLoad).toBe(1);
    expect(
      muscleContributions(d, 7, at + 48 * 3600000).find((x) => x.muscle === 'chest')?.recentLoad,
    ).toBeCloseTo(0.5);
  });
  it('respects date ranges and includes no warm-up contribution', () => {
    const d = fixture();
    d.sets[0].label = 'warmup';
    expect(muscleContributions(d, 7, Date.parse(t)).every((m) => m.sets === 0)).toBe(true);
    d.sets[0].label = 'working';
    expect(muscleContributions(d, 7, Date.parse(t) + 9 * 86400000).every((m) => m.sets === 0)).toBe(
      true,
    );
  });
  it('maps zero to neutral and caps very large contributions', () => {
    expect(heatColor(0, 12)).toBe(contributionColors[0]);
    expect(heatColor(100, 12)).toBe(contributionColors[5]);
  });
});
describe('calendar, bodyweight and timer', () => {
  it('builds a Monday-first calendar including leap day', () => {
    const days = calendarDays(2024, 1);
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(days.some((d) => dateKey(d) === '2024-02-29')).toBe(true);
  });
  it('aggregates actual completed workouts by local day', () => {
    const d = fixture();
    expect(dayStats(d, dateKey(t))).toEqual({ count: 1, sets: 1, volume: 720, duration: 60 });
    expect(dayStats(d, '2026-10-14').count).toBe(0);
  });
  it('keeps multiple bodyweight readings without inventing missing dates', () => {
    const d = fixture();
    d.bodyweights = [
      { id: 'a', at: '2026-10-01T08:00:00Z', kg: 80, notes: '' },
      { id: 'b', at: '2026-10-10T08:00:00Z', kg: 78, notes: '' },
      { id: 'c', at: '2026-10-10T09:00:00Z', kg: 80, notes: '' },
    ];
    const trend = bodyweightTrend(d);
    expect(trend).toHaveLength(3);
    expect(trend[1].average).toBe(78);
    expect(trend[2].average).toBe(79);
  });
  it('recalculates a timer from its deadline after backgrounding', () => {
    const timer = {
      id: 'rest' as const,
      endAt: 100000,
      durationMs: 90000,
      exerciseName: 'Bench',
      notified: false,
    };
    expect(remainingMs(timer, 40000)).toBe(60000);
    expect(remainingMs(timer, 150000)).toBe(0);
    expect(remainingMs({ ...timer, endAt: undefined, pausedMs: 4000 }, 150000)).toBe(4000);
  });
  it('escapes CSV quotes, newlines and spreadsheet formulas', () => {
    expect(csv([['a,b', 'a"b', '=SUM(A1)', 'hello\nworld']])).toBe(
      '"a,b","a""b","\'=SUM(A1)","hello\nworld"',
    );
  });
});
describe('historical context and scale', () => {
  it('does not claim a new personal record for a later tie', () => {
    const d = fixture();
    d.sessions.push({
      ...d.sessions[0],
      id: 's2',
      startAt: '2026-10-16T12:00:00Z',
      endAt: '2026-10-16T13:00:00Z',
    });
    d.sets.push({ ...d.sets[0], id: 'later', sessionId: 's2' });
    expect(personalRecords(d).find((r) => r.kind === 'Heaviest load')?.sessionId).toBe('s1');
  });
  it('keeps incompatible tracking types out of comparisons', () => {
    const d = fixture();
    d.exercises[0].tracking = 'duration';
    expect(exerciseHistory(d, d.exercises[0].id)).toHaveLength(0);
    expect(exerciseHistory(d, d.exercises[0].id, 'weighted')).toHaveLength(1);
  });
  it('handles ten years of history without quadratic muscle lookups', () => {
    const d = fixture();
    const source = d.sessions[0],
      set = d.sets[0];
    d.sessions = [];
    d.sets = [];
    for (let n = 0; n < 1500; n++) {
      const start = new Date(Date.parse(t) - n * 2 * 86400000).toISOString();
      const end = new Date(Date.parse(start) + 3600000).toISOString();
      d.sessions.push({ ...source, id: 's' + n, startAt: start, endAt: end });
      for (let k = 0; k < 20; k++)
        d.sets.push({ ...set, id: `${n}-${k}`, sessionId: 's' + n, order: k });
    }
    const at = performance.now();
    const muscles = muscleContributions(d, 0, Date.parse(t) + 3600000);
    const records = personalRecords(d);
    expect(muscles.find((m) => m.muscle === 'chest')?.sets).toBe(30000);
    expect(records.length).toBeGreaterThan(0);
    expect(performance.now() - at).toBeLessThan(2000);
  });
});
