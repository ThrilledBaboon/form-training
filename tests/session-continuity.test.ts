import { expect, it } from 'vitest';
import { sessionFixture } from './session-fixture';
import { previousExerciseSession } from '../src/lib/session-continuity';
it('finds only earlier comparable history and retains exercise/set notes and partial observations', () => {
  const d = sessionFixture(),
    past = d.sessions[0],
    item = past.items[0];
  item.notes = 'Slow the eccentric';
  d.sets[0].notes = 'Left shoulder felt shaky';
  d.sets[0].partialReps = 2;
  const current = {
    ...structuredClone(past),
    id: 'current',
    startAt: '2026-10-15T08:00:00.000Z',
    status: 'active' as const,
    items: [{ ...item, id: 'new-item', notes: '' }],
  };
  const future = {
    ...structuredClone(past),
    id: 'future',
    startAt: '2026-10-16T08:00:00.000Z',
    endAt: '2026-10-16T09:00:00.000Z',
  };
  d.sessions.push(future, current);
  d.sets.push(
    ...d.sets
      .filter((s) => s.sessionId === past.id)
      .map((s) => ({ ...s, id: 'future-' + s.id, sessionId: future.id, notes: 'Not yet' })),
  );
  const result = previousExerciseSession(d, current, current.items[0])!;
  expect(result.session.id).toBe(past.id);
  expect(result.item.notes).toBe('Slow the eccentric');
  expect(result.noteSets[0]).toMatchObject({ notes: 'Left shoulder felt shaky', partialReps: 2 });
  current.items[0].setup = {
    id: 'other-machine',
    name: 'Other machine',
    gym: '',
    machine: '',
    settings: '',
    attachment: '',
    notes: '',
    basis: 'total',
  };
  expect(previousExerciseSession(d, current, current.items[0])).toBeUndefined();
});
it('does not guess same-day order for date-only entries or mix repeated exercise notes', () => {
  const d = sessionFixture(),
    past = d.sessions[0],
    first = past.items[0];
  const second = { ...structuredClone(first), id: 'second', notes: 'Second occurrence cue' };
  past.items.push(second);
  d.sets.push({ ...d.sets[0], id: 'second-set', itemId: second.id });
  const current = {
    ...structuredClone(past),
    id: 'current',
    startAt: '2026-10-15T08:00:00.000Z',
    items: [
      { ...first, id: 'current-first' },
      { ...second, id: 'current-second' },
    ],
  };
  expect(previousExerciseSession(d, current, current.items[1])?.item.notes).toBe(
    'Second occurrence cue',
  );
  past.dateOnly = true;
  past.startAt = '2026-10-15T00:00:00.000Z';
  expect(previousExerciseSession(d, current, current.items[0])).toBeUndefined();
});
