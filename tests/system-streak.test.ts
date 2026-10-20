import { describe, expect, it } from 'vitest';
import { fixture } from './fixtures';
import { systemStreak } from '../src/lib/streak';
import { emptyClimbing, ClimbingSessionSchema } from '../src/lib/climbing-model';
import {
  emptyPractice,
  PracticeSessionSchema,
  type PracticeSystem,
} from '../src/lib/practice-model';
import { footballStarters, rocketLeagueStarters } from '../src/lib/practice-library';

const at = (day: string) => new Date(day + 'T14:00:00').getTime();
function practice(system: PracticeSystem, ...days: string[]) {
  const library = system === 'football' ? footballStarters() : rocketLeagueStarters();
  const drill = library.drills[0];
  const block = library.routines[0].blocks[0];
  return {
    ...emptyPractice(system),
    ...library,
    sessions: days.map((day, i) =>
      PracticeSessionSchema.parse({
        id: 's' + i,
        name: 'Practice',
        startAt: new Date(day + 'T12:00:00').toISOString(),
        endAt: new Date(day + 'T13:00:00').toISOString(),
        status: 'completed',
        cursor: 0,
        timer: { phase: 'work', elapsedSeconds: 30, targetSeconds: 60 },
        entries: [{ id: 'e', drill, block, set: 1, status: 'completed', elapsedSeconds: 30 }],
      }),
    ),
  };
}
function climbing(...days: string[]) {
  return {
    ...emptyClimbing,
    sessions: days.map((date, i) =>
      ClimbingSessionSchema.parse({
        id: 'c' + i,
        name: 'Climbing',
        date,
        status: 'completed',
        updatedAt: '2026-10-15T12:00:00Z',
        entries: [
          { id: 'e', climbId: 'c', snapshot: { name: 'Project' }, attempts: 3, result: 'attempt' },
        ],
      }),
    ),
  };
}
describe('independent activity streaks', () => {
  it('isolates all four histories and banks, counts same-day visits once and leaves source data untouched', () => {
    const data = fixture();
    data.climbing = climbing('2026-10-12', '2026-10-14', '2026-10-14');
    data.practice = [
      practice('football', '2026-10-15'),
      practice('rocket-league', '2026-10-13', '2026-10-15'),
    ];
    const original = JSON.stringify(data);
    expect(systemStreak(data, 'gym', at('2026-10-15'))).toMatchObject({
      current: 1,
      restDaysLeft: 5,
    });
    expect(systemStreak(data, 'football', at('2026-10-15'))).toMatchObject({
      current: 1,
      restDaysLeft: 5,
    });
    expect(systemStreak(data, 'rocket-league', at('2026-10-15'))).toMatchObject({
      current: 2,
      restDaysLeft: 5,
    });
    const climb = systemStreak(data, 'climbing', at('2026-10-15'));
    expect(climb).toMatchObject({ current: 2, restDaysLeft: 5 });
    expect(climb.days.get('2026-10-14')?.workouts).toBe(2);
    expect(JSON.stringify(data)).toBe(original);
    data.practice[0].sessions = [];
    expect(systemStreak(data, 'football', at('2026-10-15')).current).toBe(0);
    expect(systemStreak(data, 'rocket-league', at('2026-10-15')).current).toBe(2);
  });
  it.each(['football', 'rocket-league'] as const)(
    '%s counts finished practice without scores, excludes active, skipped and future sessions and recalculates corrections',
    (system) => {
      const data = fixture();
      const p = practice(system, '2026-10-10', '2026-10-12', '2026-10-14', '2026-10-16');
      data.practice = [p];
      expect(systemStreak(data, system, at('2026-10-15')).current).toBe(3);
      p.sessions[1].status = 'active';
      p.sessions[2].entries[0].status = 'skipped';
      expect(systemStreak(data, system, at('2026-10-15'))).toMatchObject({
        current: 1,
        restDaysLeft: 1,
      });
      p.sessions[0].endAt = new Date('2026-10-15T22:00:00').toISOString();
      expect(systemStreak(data, system, at('2026-10-15')).current).toBe(0);
      p.sessions[0].endAt = new Date('2026-10-10T13:00:00').toISOString();
      p.sessions[0].startAt = new Date('2026-10-09T23:50:00').toISOString();
      expect(systemStreak(data, system, at('2026-10-15')).days.get('2026-10-09')?.kind).toBe(
        'workout',
      );
      p.sessions = [];
      expect(systemStreak(data, system, at('2026-10-15')).longest).toBe(0);
    },
  );
  it('counts recorded climbing attempts across disciplines, excluding drafts, empty and future dates', () => {
    const data = fixture();
    data.climbing = climbing('2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16');
    data.climbing.sessions[0].entries[0].snapshot.type = 'lead';
    data.climbing.sessions[1].status = 'draft';
    data.climbing.sessions[2].entries = [];
    expect(systemStreak(data, 'climbing', at('2026-10-15'))).toMatchObject({
      current: 1,
      restDaysLeft: 3,
    });
    data.climbing.sessions[0].date = '2026-10-11';
    expect(systemStreak(data, 'climbing', at('2026-10-15')).days.get('2026-10-11')?.kind).toBe(
      'workout',
    );
    data.climbing.sessions = [];
    expect(systemStreak(data, 'climbing', at('2026-10-15')).current).toBe(0);
  });
  it('preserves empty states and expires each bank independently while keeping its longest run', () => {
    const data = fixture();
    expect(systemStreak(data, 'climbing', at('2026-10-15')).days.size).toBe(0);
    expect(systemStreak(data, 'football', at('2026-10-15')).restDaysLeft).toBe(0);
    data.practice = [practice('football', '2026-10-01', '2026-10-02', '2026-10-12')];
    expect(systemStreak(data, 'football', at('2026-10-12'))).toMatchObject({
      current: 1,
      longest: 2,
      restDaysLeft: 5,
    });
    expect(systemStreak(data, 'football', at('2026-10-19'))).toMatchObject({
      current: 0,
      longest: 2,
      restDaysLeft: 0,
    });
  });
});
