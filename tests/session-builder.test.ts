import { describe, expect, it } from 'vitest';
import { fixture } from './fixtures';
import { sessionFixture } from './session-fixture';
import {
  buildCindySession,
  buildFullBodySession,
  improveRoutineSession,
  recordedCoverage,
  suggestionRole,
  swapSuggestedExercise,
} from '../src/lib/session-builder';
import { SuggestionPreferencesSchema, BenchmarkSchema } from '../src/lib/suggestion-preferences';
import { benchmarkFormat, benchmarkScore } from '../src/lib/benchmark';
import { type Data, type Muscle, type Session } from '../src/lib/model';
const at = Date.parse('2026-10-15T15:00:00Z');
const preferences = (patch: Record<string, unknown> = {}) =>
  SuggestionPreferencesSchema.parse({ mode: 'full_body', ...patch });
const priorities: Muscle[] = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'upper_back',
  'lats',
];
function foundation(data: Data, result: ReturnType<typeof buildFullBodySession>) {
  expect(result.exercises.slice(0, 3).map((e) => e.slot)).toEqual(['push', 'pull', 'legs']);
  const roles = result.source.items
    .slice(0, 3)
    .map((i) => suggestionRole(data.exercises.find((e) => e.id === i.exerciseId)!));
  expect(roles[0]).toBe('push');
  expect(roles[1]).toBe('pull');
  expect(['squat', 'hinge']).toContain(roles[2]);
}
describe('balanced session building', () => {
  it('protects the compound foundation even when smaller muscles have the least recorded work', () => {
    const data = fixture();
    for (const m of data.mappings)
      if (!['calves', 'adductors', 'abductors'].includes(m.muscle))
        data.sets.push({
          ...data.sets[0],
          id: m.id,
          exerciseId: data.sessions[0].items[0].exerciseId,
        });
    const before = structuredClone(data);
    const result = buildFullBodySession(
      data,
      preferences({ priorityMuscles: priorities }),
      'normal',
      at,
    );
    foundation(data, result);
    expect(result.blocked).toBe(false);
    expect(result.exercises.slice(3).every((e) => e.slot === 'accessory')).toBe(true);
    expect(result.source.items).toHaveLength(6);
    expect(data).toEqual(before);
  });
  it('gives chest a push slot and intentional direct shoulder work when those are priorities', () => {
    const data = fixture();
    const result = buildFullBodySession(
      data,
      preferences({ priorityMuscles: priorities }),
      'normal',
      at,
    );
    const targets = (id: string) =>
      data.mappings.filter((m) => m.exerciseId === id && m.role === 'primary').map((m) => m.muscle);
    expect(targets(result.source.items[0].exerciseId)).toContain('chest');
    expect(
      result.source.items
        .slice(3)
        .some((i) => targets(i.exerciseId).some((m) => m.endsWith('delts'))),
    ).toBe(true);
  });
  it('keeps chest and direct shoulder work in the default full-body template without priority selections', () => {
    const data = fixture();
    const result = buildFullBodySession(data, preferences(), 'normal', at);
    const muscles = result.source.items.flatMap((i) =>
      data.mappings
        .filter((m) => m.exerciseId === i.exerciseId && m.role === 'primary')
        .map((m) => m.muscle),
    );
    expect(muscles).toContain('chest');
    expect(muscles.some((m) => m.endsWith('delts'))).toBe(true);
  });
  it('preserves time and distance targets inside an existing routine', () => {
    const data = fixture();
    const running = data.exercises.find((e) => e.name === 'Running')!;
    data.routines[0].items.push({
      ...structuredClone(data.routines[0].items[0]),
      id: 'run',
      exerciseId: running.id,
      name: running.name,
      tracking: 'distance',
      sets: [{ label: 'working', distanceM: 1000, durationSeconds: 300 }],
    });
    const result = improveRoutineSession(
      data,
      { key: 'r', source: data.routines[0], kind: 'routine' },
      preferences({ mode: 'routine' }),
      'normal',
      at,
    );
    expect(result.blocked).not.toBe(true);
    expect(result.source.items.at(-1)?.sets).toEqual([
      { label: 'working', distanceM: 1000, durationSeconds: 300 },
    ]);
  });
  it('can turn coverage off without losing the full-body foundation', () => {
    const data = fixture();
    const result = buildFullBodySession(
      data,
      preferences({ balanceCoverage: false, accessoryLimit: 0 }),
      'normal',
      at,
    );
    foundation(data, result);
    expect(result.source.items).toHaveLength(3);
  });
  it('uses only completed, past, non-warm-up conventional work in coverage', () => {
    const data = fixture();
    const reference = recordedCoverage(data, 14, at);
    for (const patch of [
      { status: 'active' },
      { status: 'cancelled' },
      { startAt: '2026-10-16T08:00:00Z' },
      { endAt: '2026-10-16T08:00:00Z' },
      {
        benchmark: BenchmarkSchema.parse({
          kind: 'cindy',
          variant: 'standard',
          durationSeconds: 1200,
          reps: [5, 10, 15],
        }),
      },
    ]) {
      const copy = structuredClone(data);
      Object.assign(copy.sessions[0], patch);
      expect(recordedCoverage(copy, 14, at).coverage.size).toBe(0);
    }
    data.sets.push(
      { ...data.sets[0], id: 'warm-up', label: 'warmup' },
      { ...data.sets[0], id: 'future', completedAt: '2026-10-16T08:00:00Z' },
      { ...data.sets[0], id: 'unfinished', completed: false },
    );
    data.plans.push({
      id: 'tomorrow',
      date: '2026-10-16',
      name: 'Planned',
      status: 'planned',
      items: data.sessions[0].items,
      groups: [],
      notes: '',
    });
    expect(recordedCoverage(data, 14, at)).toEqual(reference);
  });
  it('honours the selected coverage window and recalculates when history is removed', () => {
    const data = fixture();
    data.sessions[0].startAt = '2026-10-05T08:00:00Z';
    data.sessions[0].endAt = '2026-10-05T09:00:00Z';
    expect(recordedCoverage(data, 7, at).coverage.size).toBe(0);
    expect(recordedCoverage(data, 14, at).coverage.get('chest')).toBe(1);
    data.sessions = [];
    expect(recordedCoverage(data, 14, at).coverage.size).toBe(0);
  });
  it('never substitutes accessory movements for missing equipment-constrained compounds', () => {
    const data = fixture();
    const result = buildFullBodySession(
      data,
      preferences({ equipment: ['Machine'] }),
      'normal',
      at,
    );
    expect(result.blocked).toBe(true);
    expect(result.warnings?.join(' ')).toContain('compound push');
    expect(result.exercises.every((e) => e.slot !== 'accessory')).toBe(true);
    expect(
      result.source.items.every(
        (i) => data.exercises.find((e) => e.id === i.exerciseId)?.equipment === 'Machine',
      ),
    ).toBe(true);
  });
  it('honours archived exercises and explicit exclusions', () => {
    const data = fixture();
    const first = buildFullBodySession(data, preferences(), 'normal', at);
    const excluded = first.source.items[0].exerciseId;
    data.exercises.find((e) => e.id === first.source.items[1].exerciseId)!.archived = true;
    const next = buildFullBodySession(
      data,
      preferences({ excludedExerciseIds: [excluded] }),
      'normal',
      at,
    );
    expect(next.source.items.some((i) => i.exerciseId === excluded)).toBe(false);
    expect(
      next.source.items.every((i) => !data.exercises.find((e) => e.id === i.exerciseId)!.archived),
    ).toBe(true);
  });
  it('accepts an explicit compound role for custom exercises without guessing it from a name', () => {
    const data = fixture();
    data.exercises.forEach((e) => {
      if (suggestionRole(e) === 'push') e.archived = true;
    });
    data.exercises.push({
      ...data.exercises[0],
      id: 'custom-push',
      name: 'My chest machine',
      archived: false,
      suggestionRole: 'push',
    });
    const result = buildFullBodySession(data, preferences(), 'normal', at);
    expect(result.source.items[0].exerciseId).toBe('custom-push');
    expect(result.blocked).toBe(false);
  });
  it('trims accessories first for a shorter session and reports an impossible time target', () => {
    const data = fixture();
    const short = buildFullBodySession(
      data,
      preferences({ timeMinutes: 20, accessoryLimit: 5 }),
      'normal',
      at,
    );
    foundation(data, short);
    expect(short.source.items).toHaveLength(3);
    const tiny = buildFullBodySession(data, preferences({ timeMinutes: 10 }), 'normal', at);
    foundation(data, tiny);
    expect(tiny.warnings?.join(' ')).toContain('exceeds');
  });
  it('preserves routines by default and adds accessories only when requested', () => {
    const data = sessionFixture();
    const choice = { key: 'test', source: data.routines[0], kind: 'routine' as const };
    const normal = improveRoutineSession(
      data,
      choice,
      preferences({ mode: 'routine' }),
      'normal',
      at,
    );
    expect(normal.source.items.map((i) => i.exerciseId)).toEqual(
      choice.source.items.map((i) => i.exerciseId),
    );
    const extra = improveRoutineSession(
      data,
      choice,
      preferences({ mode: 'routine', addAccessories: true, accessoryLimit: 2 }),
      'normal',
      at,
    );
    expect(extra.source.items).toHaveLength(4);
    expect(data.routines[0].items).toHaveLength(2);
    expect(
      improveRoutineSession(data, choice, preferences({ equipment: ['Machine'] }), 'normal', at)
        .blocked,
    ).toBe(true);
  });
  it('offers normal, conservative and disabled progression, plus a temporary low-energy override', () => {
    const data = sessionFixture();
    const choice = { key: 'test', source: data.routines[0], kind: 'routine' as const };
    expect(
      improveRoutineSession(data, choice, preferences(), 'normal', at).source.items[0].sets[0]
        .loadKg,
    ).toBe(62.5);
    expect(
      improveRoutineSession(
        data,
        choice,
        preferences({ progression: 'conservative' }),
        'normal',
        at,
      ).source.items[0].sets[0],
    ).toMatchObject({ loadKg: 60, reps: 12 });
    expect(
      improveRoutineSession(data, choice, preferences({ progression: 'off' }), 'normal', at).source
        .items[1].sets[0].reps,
    ).toBe(9);
    expect(
      improveRoutineSession(data, choice, preferences(), 'low_energy', at).source.items[0].sets[0]
        .loadKg,
    ).toBe(60);
    expect(
      buildFullBodySession(data, preferences(), 'low_energy', at).source.items.every(
        (i) => i.sets.filter((s) => s.label !== 'warmup').length === 2,
      ),
    ).toBe(true);
  });
  it('preserves every other reviewed exercise when replacing one slot', () => {
    const data = fixture();
    const p = preferences({ priorityMuscles: priorities });
    const result = buildFullBodySession(data, p, 'normal', at);
    const copy = structuredClone(result);
    const replaced = swapSuggestedExercise(data, result, 0, p, 'normal', at);
    expect(replaced.source.items[0].exerciseId).not.toBe(result.source.items[0].exerciseId);
    expect(replaced.source.items.slice(1)).toEqual(result.source.items.slice(1));
    expect(result).toEqual(copy);
    foundation(data, replaced);
  });
  it('keeps locked choices during regeneration and gives no silent substitution when constraints conflict', () => {
    const data = fixture();
    const p = preferences();
    const initial = buildFullBodySession(data, p, 'normal', at);
    const locked = initial.source.items[0];
    const result = buildFullBodySession(data, p, 'normal', at, 2, { push: locked });
    expect(result.source.items[0]).toEqual(locked);
    expect(
      buildFullBodySession(
        data,
        { ...p, excludedExerciseIds: [locked.exerciseId] },
        'normal',
        at,
        2,
        { push: locked },
      ).blocked,
    ).toBe(true);
  });
  it('adds warm-ups with unknown loads and supersets only to generated accessories', () => {
    const data = fixture();
    const result = buildFullBodySession(
      data,
      preferences({ includeWarmup: true, allowSupersets: true, timeMinutes: 90 }),
      'normal',
      at,
    );
    expect(result.source.items[0].sets[0]).toMatchObject({ label: 'warmup' });
    expect(result.source.items[0].sets[0].loadKg).toBeUndefined();
    expect(result.source.groups[0].type).toBe('superset');
    expect(result.source.items.slice(0, 3).every((i) => !i.groupId)).toBe(true);
  });
  it('explains climbing overlap without adding imaginary muscle sets', () => {
    const data = fixture();
    data.climbing = {
      id: 'climbing',
      revision: 0,
      climbs: [],
      plans: [
        {
          id: 'climb',
          name: 'Bouldering',
          date: '2026-10-16',
          venue: '',
          notes: '',
          type: 'bouldering',
          updatedAt: new Date(at).toISOString(),
        },
      ],
      sessions: [],
    };
    const before = recordedCoverage(data, 14, at);
    const result = buildFullBodySession(data, preferences(), 'normal', at);
    foundation(data, result);
    expect(result.warnings?.join(' ')).toContain('Climbing');
    expect(recordedCoverage(data, 14, at)).toEqual(before);
    expect(
      buildFullBodySession(
        data,
        preferences({ considerClimbing: false }),
        'normal',
        at,
      ).warnings?.join(' '),
    ).not.toContain('Climbing');
  });
  it('uses upcoming plans as a preference without counting them as completed coverage', () => {
    const data = fixture();
    const p = preferences({ balanceCoverage: false, accessoryLimit: 0 });
    const initial = buildFullBodySession(data, p, 'normal', at);
    data.plans.push({
      id: 'tomorrow',
      name: 'Upcoming',
      date: '2026-10-16',
      status: 'planned',
      items: initial.source.items,
      groups: [],
      notes: '',
    });
    expect(buildFullBodySession(data, p, 'normal', at).source.items[0].exerciseId).not.toBe(
      initial.source.items[0].exerciseId,
    );
    expect(
      buildFullBodySession(data, { ...p, respectSchedule: false }, 'normal', at).source.items[0]
        .exerciseId,
    ).toBe(initial.source.items[0].exerciseId);
  });
  it('builds Cindy with an immutable standard format and separately comparable variants', () => {
    const data = fixture();
    const result = buildCindySession(
      data,
      preferences({ progression: 'normal', accessoryLimit: 5 }),
      at,
    );
    expect(result.source.items.map((i) => i.sets[0].reps)).toEqual([5, 10, 15]);
    expect(result.source.benchmark?.durationSeconds).toBe(1200);
    expect(result.exercises.every((e) => e.change === 'unchanged')).toBe(true);
    const session = {
      ...data.sessions[0],
      items: result.source.items,
      benchmark: result.source.benchmark,
    } as Session;
    expect(benchmarkScore({ ...session.benchmark!, rounds: 10, extraReps: 12 })).toBe(312);
    expect(benchmarkFormat(session)).not.toBe(
      benchmarkFormat({ ...session, benchmark: { ...session.benchmark!, variant: 'modified' } }),
    );
    expect(() => BenchmarkSchema.parse({ ...session.benchmark, reps: [4, 10, 15] })).toThrow();
    expect(() => BenchmarkSchema.parse({ ...session.benchmark, extraReps: 30 })).toThrow();
  });
});
