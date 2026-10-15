import { catalogue } from '../src/lib/catalogue';
import {
  defaults,
  emptyData,
  type Data,
  type Session,
  type WorkoutSet,
  type Item,
} from '../src/lib/model';
export const t = '2026-10-15T12:00:00.000Z';
export function fixture(): Data {
  const c = catalogue();
  const e = c.exercises.find((e) => e.name === 'Barbell bench press')!;
  const item: Item = {
    id: 'i1',
    exerciseId: e.id,
    name: e.name,
    tracking: e.tracking,
    includeBodyweight: false,
    notes: '',
    repMin: 8,
    repMax: 12,
    restSeconds: 90,
    sets: [{ reps: 12, loadKg: 60, label: 'working' }],
  };
  const session: Session = {
    id: 's1',
    name: 'Upper session',
    startAt: t,
    endAt: '2026-10-15T13:00:00.000Z',
    status: 'completed',
    items: [item],
    groups: [],
    notes: '',
    updatedAt: t,
  };
  const set: WorkoutSet = {
    id: 'set1',
    sessionId: 's1',
    itemId: 'i1',
    exerciseId: e.id,
    order: 0,
    reps: 12,
    loadKg: 60,
    restSeconds: 90,
    label: 'working',
    completed: true,
    completedAt: t,
    notes: '',
  };
  return {
    ...structuredClone(emptyData),
    ...c,
    settings: { ...defaults },
    sessions: [session],
    sets: [set],
  };
}
