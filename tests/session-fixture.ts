import { fixture } from './fixtures';
import type { Item } from '../src/lib/model';

export function sessionFixture() {
  const data = fixture();
  const bench = data.sessions[0].items[0];
  bench.sets = Array.from({ length: 3 }, () => ({
    label: 'working' as const,
    loadKg: 60,
    reps: 8,
  }));
  const pushup = data.exercises.find((e) => e.name === 'Push-up')!;
  const item: Item = {
    ...structuredClone(bench),
    id: 'pushup-item',
    exerciseId: pushup.id,
    name: pushup.name,
    tracking: 'bodyweight',
    sets: Array.from({ length: 2 }, () => ({ label: 'working', reps: 8 })),
  };
  data.routines = [
    {
      ...data.routines[0],
      id: 'suggestion-routine',
      name: 'Thursday upper',
      weekdays: [4],
      items: [structuredClone(bench), structuredClone(item)],
      groups: [],
    },
  ];
  const session = data.sessions[0];
  session.name = 'Last week upper';
  session.routineId = data.routines[0].id;
  session.startAt = '2026-10-08T08:00:00.000Z';
  session.endAt = '2026-10-08T09:00:00.000Z';
  session.items = [bench, item];
  const template = data.sets[0];
  data.sets = session.items.flatMap((item) =>
    item.sets.map((set, order) => ({
      ...template,
      ...set,
      id: `${item.id}-${order}`,
      itemId: item.id,
      exerciseId: item.exerciseId,
      order,
      loadKg: item.tracking === 'bodyweight' ? 0 : 60,
      reps: item.tracking === 'bodyweight' ? 9 : 12,
      completedAt: session.endAt,
    })),
  );
  data.plans = [
    {
      id: 'next-upper',
      routineId: data.routines[0].id,
      name: 'Scheduled upper',
      date: '2026-10-15',
      status: 'planned',
      items: structuredClone(data.routines[0].items),
      groups: [],
      notes: 'Planned workout',
    },
  ];
  return data;
}
