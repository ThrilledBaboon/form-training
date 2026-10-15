import { describe, expect, it } from 'vitest';
import { sessionFixture } from './session-fixture';
import { sessionChoices, suggestSession, type SessionChoice } from '../src/lib/suggestions';
import { toKg, fromKg } from '../src/lib/calc';
import type { Plan } from '../src/lib/model';
const at = Date.parse('2026-10-15T15:00:00Z');
const review = (data = sessionFixture()) => suggestSession(data, sessionChoices(data, at)[0], at);

describe('choosing the next session', () => {
  it('prefers dated plans and avoids a duplicate weekly occurrence', () => {
    const choices = sessionChoices(sessionFixture(), at);
    expect(choices[0]).toMatchObject({
      key: 'plan:next-upper',
      date: '2026-10-15',
      kind: 'planned',
    });
    expect(choices.filter((c) => c.date === '2026-10-15')).toHaveLength(1);
  });
  it('uses the next weekly date and respects rest days and finished occurrences', () => {
    const data = sessionFixture();
    data.plans = [{ ...data.plans[0], id: 'rest', status: 'rest', routineId: undefined }];
    expect(sessionChoices(data, at)[0]).toMatchObject({ date: '2026-10-22', kind: 'weekly' });
    data.plans = [];
    data.sessions[0].startAt = '2026-10-15T08:00:00Z';
    expect(sessionChoices(data, at)[0].date).toBe('2026-10-22');
  });
  it('orders schedules by date before unscheduled routines and ignores past/started plans', () => {
    const data = sessionFixture();
    data.routines[0].weekdays = [];
    data.plans.push(
      { ...data.plans[0], id: 'future', date: '2026-10-17' },
      { ...data.plans[0], id: 'past', date: '2026-10-01' },
      { ...data.plans[0], id: 'started', status: 'started' },
    );
    expect(sessionChoices(data, at).map((c) => c.key)).toEqual(['plan:next-upper', 'plan:future']);
    data.plans = [];
    expect(sessionChoices(data, at)[0].kind).toBe('routine');
    data.routines = [];
    expect(sessionChoices(data, at)).toEqual([]);
  });
});
describe('reviewing routine progression', () => {
  it('orders offset timestamps by their instant and excludes future set completions', () => {
    const data = sessionFixture();
    data.sessions[0].startAt = '2026-10-08T10:00:00+02:00';
    data.sessions.push({
      ...structuredClone(data.sessions[0]),
      id: 'later',
      startAt: '2026-10-08T09:00:00Z',
      endAt: '2026-10-08T10:00:00Z',
    });
    data.sets.push(
      ...data.sets.map((set) => ({
        ...set,
        id: `later-${set.id}`,
        sessionId: 'later',
        loadKg: 80,
      })),
    );
    expect(review(data).previous?.id).toBe('later');
    data.sets
      .filter((set) => set.sessionId === 'later')
      .forEach((set) => {
        set.completedAt = '2026-10-16T10:00:00Z';
      });
    expect(review(data).previous?.id).toBe('s1');
  });
  it('increases load at the upper rep target and builds reps below it without mutating records', () => {
    const data = sessionFixture();
    const original = structuredClone(data);
    const result = review(data);
    expect(result.previous?.id).toBe('s1');
    expect(result.exercises.map((e) => e.change)).toEqual(['weight', 'reps']);
    expect(result.source.items[0].sets).toEqual(
      Array.from({ length: 3 }, () => ({ label: 'working', loadKg: 62.5, reps: 8 })),
    );
    expect(result.source.items[1].sets.map((s) => s.reps)).toEqual([10, 10]);
    expect(data).toEqual(original);
  });
  it('ignores a newer workout of a different routine, cancelled, unfinished and future sessions', () => {
    const data = sessionFixture();
    for (const [id, patch] of Object.entries({
      other: { routineId: 'other' },
      active: { status: 'active' as const },
      cancelled: { status: 'cancelled' as const },
      future: { endAt: '2026-10-16T09:00:00Z' },
    })) {
      data.sessions.push({ ...data.sessions[0], id, startAt: '2026-10-15T08:00:00Z', ...patch });
      data.sets.push(
        ...data.sets
          .filter((s) => s.sessionId === 's1')
          .map((s) => ({ ...s, id: `${id}-${s.id}`, sessionId: id, loadKg: 200 })),
      );
    }
    expect(review(data).source.items[0].sets[0].loadKg).toBe(62.5);
  });
  it('holds when effort is high, RIR is zero or a failure set was logged', () => {
    for (const patch of [{ rpe: 10 }, { rir: 0 }, { label: 'failure' as const }]) {
      const data = sessionFixture();
      Object.assign(data.sets[0], patch);
      const result = review(data).exercises[0];
      expect(result.change).toBe('hold');
      expect(result.item.sets[0]).toMatchObject({ loadKg: 60, reps: 12 });
    }
  });
  it('holds after a rep decline at the same load within this routine', () => {
    const data = sessionFixture();
    data.sessions.push({
      ...structuredClone(data.sessions[0]),
      id: 'older',
      startAt: '2026-10-01T08:00:00Z',
      endAt: '2026-10-01T09:00:00Z',
    });
    data.sets.push(
      ...data.sets.map((s) => ({
        ...s,
        id: `older-${s.id}`,
        sessionId: 'older',
        reps: 16,
        completedAt: '2026-10-01T09:00:00Z',
      })),
    );
    expect(review(data).exercises[0].change).toBe('hold');
    expect(review(data).exercises[0].reason).toContain('15%');
  });
  it('keeps planned targets for incomplete history and newly added exercises', () => {
    const data = sessionFixture();
    data.sets[1].completed = false;
    const result = review(data);
    expect(result.exercises[0].change).toBe('hold');
    expect(result.source.items[0].sets).toEqual(data.plans[0].items[0].sets);
    data.sets = data.sets.filter((s) => s.itemId !== 'pushup-item');
    expect(review(data).exercises[1].change).toBe('baseline');
  });
  it('preserves warm-ups, groups, rest rules, time and distance targets', () => {
    const data = sessionFixture();
    const source = data.plans[0];
    source.items[0].sets.unshift({ label: 'warmup', reps: 5, loadKg: 20, restSeconds: 30 });
    source.items[0].groupId = 'group';
    source.groups = [
      { id: 'group', type: 'superset', name: 'A', restSeconds: 80, betweenSeconds: 10, notes: '' },
    ];
    source.items.push(
      {
        ...source.items[0],
        id: 'timed',
        tracking: 'duration',
        sets: [{ label: 'working', durationSeconds: 45 }],
      },
      {
        ...source.items[0],
        id: 'distance',
        tracking: 'distance',
        sets: [{ label: 'working', distanceM: 1000, durationSeconds: 300 }],
      },
    );
    const result = review(data);
    expect(result.source.items[0].sets[0]).toEqual(source.items[0].sets[0]);
    expect(result.source.items[0].sets[1].loadKg).toBe(62.5);
    expect(result.source.groups).toEqual(source.groups);
    expect(result.source.items.slice(2)).toEqual(source.items.slice(2));
  });
  it('keeps duplicate exercise occurrences and different tracking types separate', () => {
    const data = sessionFixture();
    const repeated = { ...structuredClone(data.sessions[0].items[0]), id: 'second-bench' };
    data.sessions[0].items.push(repeated);
    data.plans[0].items.push(structuredClone(repeated));
    data.sets.push(
      ...data.sets
        .filter((s) => s.itemId === 'i1')
        .map((s) => ({ ...s, id: `repeat-${s.id}`, itemId: repeated.id, loadKg: 40, reps: 9 })),
    );
    const result = review(data);
    expect(result.source.items[0].sets[0].loadKg).toBe(62.5);
    expect(result.source.items[2].sets[0]).toMatchObject({ loadKg: 40, reps: 10 });
    data.plans[0].items[0].tracking = 'assisted';
    expect(review(data).exercises[0].change).toBe('baseline');
  });
  it('uses configured pound increments with canonical kilogram storage', () => {
    const data = sessionFixture();
    data.settings.unit = 'lb';
    data.settings.weightIncrement = 5;
    data.sets.forEach((s) => {
      s.loadKg = toKg(100, 'lb');
    });
    expect(fromKg(review(data).source.items[0].sets[0].loadKg!, 'lb')).toBeCloseTo(105);
  });
  it('caps rep increases and never increases assistance or invents load for bodyweight', () => {
    const data = sessionFixture();
    data.settings.repIncrement = 5;
    data.plans[0].items[0].tracking = 'assisted';
    data.sessions[0].items[0].tracking = 'assisted';
    data.sets
      .filter((s) => s.itemId === 'i1')
      .forEach((s) => {
        s.reps = 10;
      });
    const result = review(data);
    expect(result.source.items[0].sets[0]).toMatchObject({ loadKg: 60, reps: 12 });
    expect(result.source.items[1].sets[0]).toEqual({ label: 'working', reps: 12 });
  });
  it('uses exact exercise/tracking structure for plans without a routine identity', () => {
    const data = sessionFixture();
    const source = data.plans[0];
    delete source.routineId;
    const choice: SessionChoice = { key: source.id, source, kind: 'planned' };
    expect(suggestSession(data, choice, at).previous?.id).toBe('s1');
    (choice.source as Plan).items.reverse();
    expect(suggestSession(data, choice, at).previous).toBeUndefined();
  });
  it('recalculates after history is corrected or removed and has an honest first-session baseline', () => {
    const data = sessionFixture();
    data.sets[0].reps = 10;
    expect(review(data).exercises[0].change).toBe('reps');
    data.sessions = [];
    expect(review(data).exercises.every((e) => e.change === 'baseline')).toBe(true);
    expect(review(data).previous).toBeUndefined();
  });
});
