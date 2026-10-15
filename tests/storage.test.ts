import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import Dexie from 'dexie';
import { TrainingDB, readData } from '../src/lib/db';
import { uid, now, defaults, type WorkoutSet } from '../src/lib/model';
import {
  startSession,
  addExercise,
  updateSet,
  completeSet,
  finishSession,
  duplicateSet,
  saveExercise,
  saveRoutine,
  saveBodyweight,
  deleteSession,
  saveSettings,
  applySuggestedTargets,
  substituteExercise,
  resetAllData,
  startSuggestedSession,
} from '../src/lib/actions';
import { sessionChoices, suggestSession } from '../src/lib/suggestions';
import { sessionFixture } from './session-fixture';
import { parseBackup, serialise, importBackup, importPreview, csvExport } from '../src/lib/backup';
let db: TrainingDB;
beforeEach(async () => {
  db = new TrainingDB('test-' + uid());
  await db.open();
});
afterEach(async () => {
  await db.delete();
});
async function session() {
  const data = await readData(db);
  const id = await startSession(data.routines[0], db);
  const workout = (await db.sessions.get(id))!;
  const sets = (await db.sets.where('sessionId').equals(id).toArray()).sort(
    (a, b) =>
      workout.items.findIndex((i) => i.id === a.itemId) -
        workout.items.findIndex((i) => i.id === b.itemId) || a.order - b.order,
  );
  return { id, sets, data };
}
describe('durable data operations', () => {
  it('starts reviewed targets atomically while preserving the plan, routine and completed history', async () => {
    const data = sessionFixture();
    await db.routines.bulkPut(data.routines);
    await db.plans.bulkPut(data.plans);
    await db.sessions.bulkPut(data.sessions);
    await db.sets.bulkPut(data.sets);
    const at = Date.parse('2026-10-15T15:00:00Z');
    const suggestion = suggestSession(data, sessionChoices(data, at)[0], at);
    const id = await startSuggestedSession(suggestion, db);
    const created = (await db.sessions.get(id))!;
    const sets = await db.sets.where('sessionId').equals(id).toArray();
    expect(created).toMatchObject({
      status: 'active',
      routineId: data.routines[0].id,
      planId: data.plans[0].id,
    });
    expect(sets.filter((s) => s.exerciseId === data.plans[0].items[0].exerciseId)).toHaveLength(3);
    expect(
      sets
        .filter((s) => s.exerciseId === data.plans[0].items[0].exerciseId)
        .every((s) => s.loadKg === 62.5 && s.reps === 8 && !s.completed),
    ).toBe(true);
    expect(
      sets
        .filter((s) => s.exerciseId === data.plans[0].items[1].exerciseId)
        .every((s) => s.reps === 10),
    ).toBe(true);
    expect(await db.plans.get(data.plans[0].id)).toEqual({ ...data.plans[0], status: 'started' });
    expect(await db.routines.get(data.routines[0].id)).toEqual(data.routines[0]);
    expect(await db.sessions.get('s1')).toEqual(data.sessions[0]);
    expect(
      (await db.sets.where('sessionId').equals('s1').toArray()).sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    ).toEqual([...data.sets].sort((a, b) => a.id.localeCompare(b.id)));
    await expect(startSuggestedSession(suggestion, db)).rejects.toThrow('active workout');
    expect(await db.sessions.where('status').equals('active').count()).toBe(1);
  });
  it('does not silently prefill a reviewed baseline or warm-up from an unrelated exercise history', async () => {
    const data = sessionFixture();
    data.sessions[0].routineId = 'another-routine';
    data.plans[0].items[0].sets = [
      { label: 'warmup', reps: 5 },
      { label: 'working', reps: 8 },
    ];
    await db.sessions.bulkPut(data.sessions);
    await db.sets.bulkPut(data.sets);
    await db.plans.bulkPut(data.plans);
    const at = Date.parse('2026-10-15T15:00:00Z');
    const suggestion = suggestSession(data, sessionChoices(data, at)[0], at);
    expect(suggestion.previous).toBeUndefined();
    const id = await startSuggestedSession(suggestion, db);
    const sets = await db.sets.where('sessionId').equals(id).toArray();
    expect(
      sets
        .filter((s) => s.exerciseId === data.plans[0].items[0].exerciseId)
        .every((s) => s.loadKg === 0),
    ).toBe(true);
  });
  it('resets all records, snapshots and preferences atomically to the original starter library', async () => {
    const original = await readData(db);
    const { sets } = await session();
    await updateSet(sets[0].id, { loadKg: 60, reps: 8 }, db);
    await completeSet(sets[0].id, db);
    await saveSettings({ theme: 'dark', goalKg: 80 }, db);
    await db.bodyweights.put({ id: uid(), at: now(), kg: 85, notes: 'Test' });
    await db.programmes.put({ id: 'custom-programme', name: 'Custom', notes: '' });
    await db.exercises.put({ ...original.exercises[0], id: 'custom-exercise', name: 'Custom' });
    await db.routines.put({ ...original.routines[0], id: 'custom-routine', name: 'Custom' });
    await db.plans.put({
      id: 'rest-plan',
      name: 'Rest',
      date: '2026-10-15',
      status: 'rest',
      items: [],
      groups: [],
      notes: '',
    });
    await db.backups.put({
      id: 'recovery',
      createdAt: now(),
      reason: 'Test',
      json: serialise(await readData(db)),
    });
    await resetAllData(db);
    const fresh = await readData(db);
    for (const records of [
      fresh.sessions,
      fresh.sets,
      fresh.bodyweights,
      fresh.programmes,
      fresh.plans,
    ])
      expect(records).toHaveLength(0);
    expect(await db.backups.count()).toBe(0);
    expect(await db.timers.count()).toBe(0);
    expect(fresh.settings).toEqual(defaults);
    expect(fresh.exercises.map((e) => e.id).sort()).toEqual(
      original.exercises.map((e) => e.id).sort(),
    );
    expect(fresh.routines.map((r) => r.id).sort()).toEqual(
      original.routines.map((r) => r.id).sort(),
    );
    expect(fresh.mappings).toHaveLength(original.mappings.length);
    await db.close();
    await db.open();
    expect((await readData(db)).sessions).toHaveLength(0);
  });
  it('rolls back the reset if restoring defaults fails, preserving the history and snapshots', async () => {
    await session();
    await db.backups.put({ id: 'keep', createdAt: now(), reason: 'Test', json: '{}' });
    const before = await readData(db);
    const failure = vi.spyOn(db.settings, 'put').mockRejectedValueOnce(new Error('Storage full'));
    await expect(resetAllData(db)).rejects.toThrow('Storage full');
    failure.mockRestore();
    expect(await readData(db)).toEqual(before);
    expect(await db.backups.count()).toBe(1);
  });
  it('populates original exercises and templates without fake training data', async () => {
    const d = await readData(db);
    expect(d.exercises.length).toBeGreaterThan(25);
    expect(d.sessions).toHaveLength(0);
    expect(d.sets).toHaveLength(0);
    expect(d.bodyweights).toHaveLength(0);
  });
  it('creates, renames and archives an exercise while retaining its history identity', async () => {
    const d = await readData(db);
    const e = { ...d.exercises[0], id: uid(), name: 'Custom press' };
    const maps = d.mappings
      .filter((m) => m.exerciseId === d.exercises[0].id)
      .map((m) => ({ ...m, id: uid(), exerciseId: e.id }));
    await saveExercise(e, maps, db);
    const id = await startSession(undefined, db);
    await addExercise(id, e, db);
    await saveExercise({ ...e, name: 'Renamed', archived: true }, maps, db);
    expect((await db.sessions.get(id))?.items[0].exerciseId).toBe(e.id);
    expect((await db.exercises.get(e.id))?.archived).toBe(true);
  });
  it('prevents multiple active workouts, including concurrent taps', async () => {
    const results = await Promise.allSettled([
      startSession(undefined, db),
      startSession(undefined, db),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.sessions.where('status').equals('active').count()).toBe(1);
  });
  it('saves each edit and restores the active session after reopening the DB', async () => {
    const { id, sets } = await session();
    await updateSet(sets[0].id, { loadKg: 75, reps: 8.5 }, db);
    const name = db.name;
    db.close();
    db = new TrainingDB(name);
    await db.open();
    expect((await db.sessions.get(id))?.status).toBe('active');
    expect(await db.sets.get(sets[0].id)).toMatchObject({
      loadKg: 75,
      reps: 8.5,
      completed: false,
    });
  });
  it('completes a set idempotently and preserves the first timer deadline', async () => {
    const { sets } = await session();
    await updateSet(sets[0].id, { loadKg: 60, reps: 10 }, db);
    await completeSet(sets[0].id, db);
    const deadline = (await db.timers.get('rest'))?.endAt;
    await completeSet(sets[0].id, db);
    expect((await db.timers.get('rest'))?.endAt).toBe(deadline);
    expect((await db.sets.toArray()).filter((s) => s.completed)).toHaveLength(1);
  });
  it('rejects invalid or missing inputs without marking the set complete', async () => {
    const { sets } = await session();
    await expect(updateSet(sets[0].id, { loadKg: -1 }, db)).rejects.toThrow();
    await expect(completeSet(sets[0].id, db)).rejects.toThrow('load');
    expect((await db.sets.get(sets[0].id))?.completed).toBe(false);
    await expect(updateSet(sets[0].id, { rpe: 8, rir: 2 }, db)).rejects.toThrow('RPE or RIR');
  });
  it('duplicates values but never copies completion', async () => {
    const { sets } = await session();
    await updateSet(sets[0].id, { loadKg: 60, reps: 8 }, db);
    await completeSet(sets[0].id, db);
    const old = (await db.sets.get(sets[0].id))!;
    await duplicateSet(old, db);
    const all = await db.sets.where('itemId').equals(old.itemId).toArray();
    expect(all).toHaveLength(4);
    expect(all.filter((s) => s.completed)).toHaveLength(1);
    expect(all.find((s) => s.order === 3)).toMatchObject({ loadKg: 60, reps: 8, completed: false });
  });
  it('finishes a session and permits historical set edits', async () => {
    const { id, sets } = await session();
    await updateSet(sets[0].id, { loadKg: 60, reps: 8 }, db);
    await completeSet(sets[0].id, db);
    await finishSession(id, db);
    expect((await db.sessions.get(id))?.endAt).toBeTruthy();
    expect(await db.timers.count()).toBe(0);
    await updateSet(sets[0].id, { loadKg: 62.5 }, db);
    expect((await db.sets.get(sets[0].id))?.loadKg).toBe(62.5);
  });
  it('substitutes in place atomically and protects completed exercise history', async () => {
    const { id, data } = await session();
    const original = (await db.sessions.get(id))!;
    const replacement = data.exercises.find((e) => e.tracking === 'duration')!;
    await substituteExercise(id, original.items[0].id, replacement, db);
    const edited = (await db.sessions.get(id))!;
    expect(edited.items[0].exerciseId).toBe(replacement.id);
    expect(edited.items.slice(1)).toEqual(original.items.slice(1));
    expect(await db.sets.where('itemId').equals(original.items[0].id).count()).toBe(0);
    const first = (await db.sets.where('itemId').equals(edited.items[0].id).first())!;
    expect(first).toMatchObject({ durationSeconds: 45, completed: false });
    await completeSet(first.id, db);
    await expect(substituteExercise(id, edited.items[0].id, data.exercises[0], db)).rejects.toThrow(
      'Completed sets',
    );
    expect((await db.sessions.get(id))?.items).toEqual(edited.items);
    expect((await db.sets.get(first.id))?.completed).toBe(true);
  });
  it('does not finish an empty session', async () => {
    const id = await startSession(undefined, db);
    await expect(finishSession(id, db)).rejects.toThrow('at least one');
    expect((await db.sessions.get(id))?.status).toBe('active');
  });
  it('snapshots routine targets and group membership', async () => {
    const d = await readData(db);
    const r = d.routines[0];
    r.groups = [
      { id: 'g', name: 'Circuit A', type: 'circuit', restSeconds: 60, notes: '3 rounds' },
    ];
    r.items[0].groupId = 'g';
    await saveRoutine(r, db);
    const id = await startSession(r, db);
    await saveRoutine({ ...r, name: 'Changed', items: [] }, db);
    const s = (await db.sessions.get(id))!;
    expect(s.name).toBe(r.name);
    expect(s.items).toHaveLength(r.items.length);
    expect(s.items[0].id).not.toBe(r.items[0].id);
    expect(s.items[0].groupId).toBe('g');
  });
  it('deletes session sets atomically and provides undo', async () => {
    const data = await readData(db);
    const routine = data.routines[0];
    const plan = {
      id: uid(),
      name: routine.name,
      date: '2026-10-16',
      status: 'planned' as const,
      items: routine.items,
      groups: routine.groups,
      notes: '',
    };
    await db.plans.add(plan);
    const id = await startSession(plan, db);
    const sets = await db.sets.where('sessionId').equals(id).toArray();
    await updateSet(sets[0].id, { loadKg: 60, reps: 8 }, db);
    await completeSet(sets[0].id, db);
    const timer = await db.timers.get('rest');
    const undo = await deleteSession(id, db);
    expect(await db.sessions.get(id)).toBeUndefined();
    expect(await db.sets.count()).toBe(0);
    expect((await db.plans.get(plan.id))?.status).toBe('planned');
    expect(await db.timers.count()).toBe(0);
    await undo();
    expect(await db.sets.count()).toBe(sets.length);
    expect((await db.plans.get(plan.id))?.status).toBe('started');
    expect(await db.timers.get('rest')).toEqual(timer);
  });
  it('rejects undo when another active workout exists without restoring its sets or timer', async () => {
    const { id } = await session();
    const undo = await deleteSession(id, db);
    const current = await startSession(undefined, db);
    await expect(undo()).rejects.toThrow('current workout');
    expect(await db.sessions.get(id)).toBeUndefined();
    expect((await db.sessions.get(current))?.status).toBe('active');
    expect(await db.sets.count()).toBe(0);
  });
  it('applies reviewed suggestions only to pending working sets and leaves history intact', async () => {
    const { id, sets, data } = await session();
    const firstItem = (await db.sessions.get(id))!.items[0];
    for (const set of sets.filter((s) => s.itemId === firstItem.id)) {
      await updateSet(set.id, { loadKg: 60, reps: firstItem.repMax }, db);
      await completeSet(set.id, db);
    }
    await finishSession(id, db);
    const history = await db.sets.where('sessionId').equals(id).toArray();
    const next = await startSession(data.routines[0], db);
    const item = (await db.sessions.get(next))!.items[0];
    const pending = (await db.sets.where('itemId').equals(item.id).toArray()).sort(
      (a, b) => a.order - b.order,
    );
    await updateSet(pending[0].id, { reps: 5, loadKg: 50 }, db);
    await completeSet(pending[0].id, db);
    await updateSet(pending[1].id, { label: 'warmup', reps: 4, loadKg: 20 }, db);
    await applySuggestedTargets(next, item.id, db);
    expect(await db.sets.get(pending[0].id)).toMatchObject({
      reps: 5,
      loadKg: 50,
      completed: true,
    });
    expect(await db.sets.get(pending[1].id)).toMatchObject({
      label: 'warmup',
      reps: 4,
      loadKg: 20,
      completed: false,
    });
    expect(await db.sets.get(pending[2].id)).toMatchObject({
      reps: item.repMin,
      loadKg: 62.5,
      completed: false,
    });
    expect(await db.sets.where('sessionId').equals(id).toArray()).toEqual(history);
  });
  it('records multiple bodyweight readings and rejects invalid values', async () => {
    const e = { id: uid(), at: now(), kg: 80, notes: '' };
    await saveBodyweight(e, db);
    await saveBodyweight({ ...e, id: uid(), kg: 81 }, db);
    expect(await db.bodyweights.count()).toBe(2);
    await expect(saveBodyweight({ ...e, kg: 0 }, db)).rejects.toThrow();
  });
  it('switches units without changing stored kg', async () => {
    const { sets } = await session();
    await updateSet(sets[0].id, { loadKg: 60 }, db);
    await saveSettings({ unit: 'lb' }, db);
    expect((await db.sets.get(sets[0].id))?.loadKg).toBe(60);
  });
});
describe('validated backups', () => {
  it('round trips a populated snapshot with stable identifiers', async () => {
    await session();
    const d = await readData(db);
    expect(parseBackup(serialise(d)).data).toEqual(d);
  });
  it('previews duplicates and repeated merges create no duplicate sets', async () => {
    await session();
    const d = await readData(db);
    const b = parseBackup(serialise(d));
    expect(importPreview(b, d).find((r) => r.table === 'sessions')?.duplicates).toBe(1);
    await importBackup(b, 'merge', db);
    await importBackup(b, 'merge', db);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.sets.count()).toBe(d.sets.length);
    expect(await db.backups.count()).toBe(2);
  });
  it('keeps existing session snapshots and their edited sets during merge', async () => {
    const { sets } = await session();
    const b = parseBackup(serialise(await readData(db)));
    await updateSet(sets[0].id, { loadKg: 90 }, db);
    await importBackup(b, 'merge', db);
    expect((await db.sets.get(sets[0].id))?.loadKg).toBe(90);
  });
  it('creates a recoverable snapshot before replacing data', async () => {
    const d = await readData(db);
    await session();
    await importBackup(parseBackup(serialise(d)), 'replace', db);
    expect(await db.sessions.count()).toBe(0);
    const backup = (await db.backups.toArray())[0];
    expect(parseBackup(backup.json).data.sessions).toHaveLength(1);
  });
  it('rejects malformed, unsupported, duplicate and dangling data before writes', async () => {
    await expect(importBackup({ schemaVersion: 99 } as never, 'replace', db)).rejects.toThrow();
    expect(() => parseBackup('{')).toThrow('valid JSON');
    const b = parseBackup(serialise(await readData(db)));
    b.data.exercises.push(b.data.exercises[0]);
    expect(() => parseBackup(JSON.stringify(b))).toThrow('Duplicate');
    b.data.exercises.pop();
    b.data.mappings[0].exerciseId = 'missing';
    expect(() => parseBackup(JSON.stringify(b))).toThrow('missing exercise');
    expect(await db.backups.count()).toBe(0);
  });
  it('rolls back the recovery snapshot if an import cannot be merged', async () => {
    await session();
    const d = await readData(db);
    d.sessions[0].id = 'different';
    d.sets = d.sets.map((s) => ({ ...s, id: uid(), sessionId: 'different' }));
    await expect(importBackup(parseBackup(serialise(d)), 'merge', db)).rejects.toThrow(
      'active workout',
    );
    expect(await db.backups.count()).toBe(0);
    expect(await db.sessions.count()).toBe(1);
  });
  it('exports useful canonical units in every CSV category', async () => {
    await session();
    const d = await readData(db);
    expect(csvExport(d, 'sessions')).toContain('"start"');
    expect(csvExport(d, 'sets')).toContain('load_or_assistance_kg');
    expect(csvExport(d, 'exercises')).toContain('"tracking"');
    expect(csvExport(d, 'bodyweight')).toContain('"bodyweight_kg"');
  });
});
describe('database upgrades', () => {
  it('migrates v1 settings without dropping stored exercises', async () => {
    const name = 'migration-' + uid();
    const old = new Dexie(name);
    old.version(1).stores({
      exercises: 'id,name,archived',
      mappings: 'id,exerciseId,muscle',
      routines: 'id,name',
      programmes: 'id',
      plans: 'id,date,status',
      sessions: 'id,status,startAt',
      sets: 'id,sessionId,exerciseId,itemId',
      bodyweights: 'id,at',
      settings: 'id',
      timers: 'id',
    });
    await old.open();
    await old.table('settings').put({ id: 'preferences', unit: 'lb' });
    await old.table('exercises').put({ id: 'retained', name: 'Test' });
    old.close();
    const upgraded = new TrainingDB(name);
    await upgraded.open();
    expect((await upgraded.settings.get('preferences'))?.unit).toBe('lb');
    expect((await upgraded.settings.get('preferences'))?.secondaryFactor).toBe(0.5);
    expect(await upgraded.exercises.get('retained')).toBeTruthy();
    expect(await upgraded.backups.count()).toBe(0);
    await upgraded.delete();
  });
});
describe('group timers and explicit targets', () => {
  it('rests between rounds rather than every exercise in a superset', async () => {
    const d = await readData(db);
    const r = d.routines[0];
    r.groups = [
      { id: 'g', name: 'A', type: 'superset', restSeconds: 120, betweenSeconds: 0, notes: '' },
    ];
    r.items = r.items.slice(0, 2).map((i) => ({ ...i, groupId: 'g' }));
    const id = await startSession(r, db);
    const s = (await db.sessions.get(id))!;
    const first = (await db.sets.where('itemId').equals(s.items[0].id).toArray())[0];
    await updateSet(first.id, { loadKg: 50, reps: 10 }, db);
    await completeSet(first.id, db);
    expect((await db.timers.get('rest'))?.durationMs).toBe(0);
    const second = (await db.sets.where('itemId').equals(s.items[1].id).toArray())[0];
    await updateSet(second.id, { loadKg: 50, reps: 10 }, db);
    await completeSet(second.id, db);
    expect((await db.timers.get('rest'))?.durationMs).toBe(120000);
  });
  it('preserves a planned zero external load for a bodyweight exercise', async () => {
    const d = await readData(db);
    const e = d.exercises.find((e) => e.tracking === 'loaded_bodyweight')!;
    const r = d.routines[0];
    r.items = [
      {
        ...r.items[0],
        exerciseId: e.id,
        name: e.name,
        tracking: e.tracking,
        sets: [{ reps: 8, loadKg: 0, label: 'working' }],
      },
    ];
    const id = await startSession(r, db);
    expect((await db.sets.where('sessionId').equals(id).toArray())[0].loadKg).toBe(0);
  });
});
it('prevents a completed set from being silently edited into an invalid measurement', async () => {
  const { sets } = await session();
  await updateSet(sets[0].id, { loadKg: 60, reps: 10 }, db);
  await completeSet(sets[0].id, db);
  await expect(updateSet(sets[0].id, { reps: undefined }, db)).rejects.toThrow('repetitions');
  expect((await db.sets.get(sets[0].id))?.reps).toBe(10);
});
