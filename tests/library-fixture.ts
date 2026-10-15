import { sessionFixture } from './session-fixture';

// Synthetic templates only; this fixture intentionally also contains private data to test exclusion.
export function libraryFixture() {
  const data = sessionFixture();
  const original = data.exercises.find((e) => e.id === data.routines[0].items[0].exerciseId)!;
  const exercise = {
    ...original,
    id: 'peer-bench',
    name: 'Peer bench press',
    notes: 'Exercise coaching note',
  };
  data.exercises.push(exercise);
  data.mappings.push({
    id: 'peer-chest',
    exerciseId: exercise.id,
    muscle: 'chest',
    role: 'primary',
    contribution: 1,
  });
  data.programmes = [
    { id: 'peer-programme', name: 'Shared strength programme', notes: 'Programme coaching note' },
  ];
  const r = data.routines[0];
  r.name = 'Peer upper routine';
  r.description = 'Routine coaching note';
  r.programmeId = data.programmes[0].id;
  r.groups = [
    {
      id: 'peer-group',
      name: 'Upper pairing',
      type: 'superset',
      restSeconds: 90,
      betweenSeconds: 15,
      notes: 'Group coaching note',
    },
  ];
  r.items[0] = {
    ...r.items[0],
    exerciseId: exercise.id,
    name: exercise.name,
    groupId: r.groups[0].id,
    notes: 'Item coaching note',
  };
  r.items[0].sets[0] = { label: 'warmup', reps: 5, loadKg: 20, restSeconds: 45 };
  r.items[0].sets[1] = { label: 'working', reps: 8, loadKg: 60, groupId: r.groups[0].id };
  data.sessions[0].notes = 'PRIVATE session note';
  data.sets[0].notes = 'PRIVATE completed set note';
  data.bodyweights = [
    { id: 'private-weight', at: data.sessions[0].startAt, kg: 75, notes: 'PRIVATE measurement' },
  ];
  data.settings.goalKg = 80;
  return data;
}
