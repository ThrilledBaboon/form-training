import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import {
  updateBenchmark,
  finishSession,
  saveSettings,
  startSuggestedSession,
  updateSession,
} from '../src/lib/actions';
import {
  buildCindySession,
  buildFullBodySession,
  recordedCoverage,
} from '../src/lib/session-builder';
import { SuggestionPreferencesSchema } from '../src/lib/suggestion-preferences';
import { workoutStreak } from '../src/lib/streak';
import { importBackup, parseBackup, serialise } from '../src/lib/backup';
import { createLibrary } from '../src/lib/library';
let db: TrainingDB;
beforeEach(async () => {
  db = new TrainingDB('suggestion-test-' + crypto.randomUUID());
  await db.open();
});
afterEach(async () => {
  await db.delete();
});
const preferences = SuggestionPreferencesSchema.parse({
  mode: 'full_body',
  priorityMuscles: ['chest', 'side_delts', 'lats'],
  equipment: ['Barbell', 'Dumbbell', 'Cable', 'Bodyweight', 'Pull-up bar'],
});
describe('suggestion persistence and compatibility', () => {
  it('merges rapid circuit score edits atomically and rejects invalid updates without partial writes', async () => {
    const id = await startSuggestedSession(buildCindySession(await readData(db), preferences), db);
    await Promise.all([
      updateBenchmark(id, (b) => ({ rounds: b.rounds + 1 }), db),
      updateBenchmark(id, { extraReps: 7 }, db),
    ]);
    expect((await db.sessions.get(id))?.benchmark).toMatchObject({ rounds: 1, extraReps: 7 });
    await expect(updateBenchmark(id, { extraReps: 30 }, db)).rejects.toThrow();
    expect((await db.sessions.get(id))?.benchmark).toMatchObject({ rounds: 1, extraReps: 7 });
  });
  it('round trips saved suggestion preferences without changing old workout data', async () => {
    const before = await readData(db);
    await saveSettings({ suggestions: preferences }, db);
    const data = await readData(db);
    expect(data.settings.suggestions).toEqual(preferences);
    expect(data.sessions).toEqual(before.sessions);
    const backup = parseBackup(serialise(data));
    expect(backup.data.settings.suggestions).toEqual(preferences);
    delete backup.data.settings.suggestions;
    await importBackup(backup, 'replace', db);
    expect((await readData(db)).settings.suggestions).toBeUndefined();
  });
  it('starts a generated session without creating a phantom routine or changing existing templates', async () => {
    const data = await readData(db);
    const result = buildFullBodySession(data, preferences);
    const id = await startSuggestedSession(result, db);
    const session = (await db.sessions.get(id))!;
    expect(session.routineId).toBeUndefined();
    expect(session.planId).toBeUndefined();
    expect(session.items.map((i) => i.exerciseId)).toEqual(
      result.source.items.map((i) => i.exerciseId),
    );
    expect(await db.routines.toArray()).toEqual(data.routines);
    await expect(startSuggestedSession(result, db)).rejects.toThrow('active workout');
    expect(await db.sessions.count()).toBe(1);
  });
  it('blocks incomplete compound foundations without writing anything', async () => {
    const data = await readData(db);
    const result = buildFullBodySession(data, { ...preferences, equipment: ['Machine'] });
    await expect(startSuggestedSession(result, db)).rejects.toThrow('missing movements');
    expect(await db.sessions.count()).toBe(0);
  });
  it('adds a missing Cindy starter only on acceptance and preserves scores without inventing working sets', async () => {
    await db.exercises.delete('exercise-air-squat');
    await db.mappings.where('exerciseId').equals('exercise-air-squat').delete();
    const data = await readData(db);
    const result = buildCindySession(data, preferences);
    expect(await db.exercises.get('exercise-air-squat')).toBeUndefined();
    const id = await startSuggestedSession(result, db);
    const session = (await db.sessions.get(id))!;
    expect(await db.exercises.get('exercise-air-squat')).toBeDefined();
    expect(await db.sets.where('sessionId').equals(id).count()).toBe(0);
    await expect(finishSession(id, db)).rejects.toThrow('completed round or additional reps');
    await updateSession(id, { benchmark: { ...session.benchmark!, rounds: 12, extraReps: 7 } }, db);
    await finishSession(id, db);
    const finished = await readData(db);
    expect(workoutStreak(finished).current).toBe(1);
    expect(recordedCoverage(finished, 14, Date.now()).coverage.size).toBe(0);
    const backup = parseBackup(serialise(finished));
    expect(backup.data.sessions.find((s) => s.id === id)?.benchmark).toMatchObject({
      rounds: 12,
      extraReps: 7,
    });
    await importBackup(backup, 'replace', db);
    expect((await db.sessions.get(id))?.benchmark?.rounds).toBe(12);
  });
  it('rolls back missing starter additions if another workout prevents starting Cindy', async () => {
    const data = await readData(db);
    await startSuggestedSession(buildFullBodySession(data, preferences), db);
    await db.exercises.delete('exercise-air-squat');
    await db.mappings.where('exerciseId').equals('exercise-air-squat').delete();
    const result = buildCindySession(await readData(db), preferences);
    await expect(startSuggestedSession(result, db)).rejects.toThrow('active workout');
    expect(await db.exercises.get('exercise-air-squat')).toBeUndefined();
  });
  it('removes scores, timers and private modification notes from shared circuit templates', async () => {
    const data = await readData(db);
    const circuit = buildCindySession(data, preferences).source;
    circuit.benchmark = {
      ...circuit.benchmark!,
      variant: 'modified',
      rounds: 10,
      extraReps: 5,
      modification: 'Private note',
      elapsedSeconds: 100,
      timerStartedAt: new Date().toISOString(),
    };
    data.routines.push(circuit as (typeof data.routines)[number]);
    const shared = createLibrary(
      data,
      { kind: 'routine', id: circuit.id },
      { notes: false, loads: false },
    );
    expect(shared.data.routines[0].benchmark).toMatchObject({
      rounds: 0,
      extraReps: 0,
      elapsedSeconds: 0,
    });
    expect(shared.data.routines[0].benchmark?.modification).toBeUndefined();
    expect(shared.data.routines[0].benchmark?.timerStartedAt).toBeUndefined();
  });
});
