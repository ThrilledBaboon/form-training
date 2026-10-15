import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import {
  createLibrary,
  parseLibrary,
  previewLibrary,
  importLibrary,
  LIBRARY_LIMIT,
} from '../src/lib/library';
import { TrainingDB, readData } from '../src/lib/db';
import { importBackup, serialise, parseBackup } from '../src/lib/backup';
import { uid, emptyData, type Data } from '../src/lib/model';
import { libraryFixture } from './library-fixture';
import { fixture } from './fixtures';

const options = { notes: true, loads: true };
const share = () =>
  createLibrary(libraryFixture(), { kind: 'programme', id: 'peer-programme' }, options);
describe('library file boundaries', () => {
  it('exports a complete programme with only its dependency exercises and no personal history', () => {
    const file = share();
    expect(file.data.exercises).toHaveLength(2);
    expect(file.data.routines).toHaveLength(1);
    expect(file.data.programmes).toHaveLength(1);
    expect(Object.keys(file.data).sort()).toEqual([
      'exercises',
      'mappings',
      'programmes',
      'routines',
    ]);
    expect(JSON.stringify(file)).not.toContain('PRIVATE');
    expect(file.data.routines[0].items[0].sets[1]).toMatchObject({
      reps: 8,
      loadKg: 60,
      groupId: 'peer-group',
    });
    expect(file.data.routines[0].groups[0].betweenSeconds).toBe(15);
    expect(parseLibrary(JSON.stringify(file))).toEqual(file);
  });
  it('excludes notes/descriptions and target weights by default while keeping reps, times, groups and schedules', () => {
    const file = createLibrary(
      libraryFixture(),
      { kind: 'programme', id: 'peer-programme' },
      { notes: false, loads: false },
    );
    expect(JSON.stringify(file)).not.toContain('coaching note');
    expect(file.data.routines[0].items[0].sets.every((s) => s.loadKg === undefined)).toBe(true);
    expect(file.data.routines[0].items[0].sets[0]).toMatchObject({
      reps: 5,
      label: 'warmup',
      restSeconds: 45,
    });
    expect(file.data.routines[0].weekdays).toEqual([4]);
  });
  it('shares individual definitions and detached routines without unrelated programmes or exercises', () => {
    const data = libraryFixture();
    const ex = createLibrary(data, { kind: 'exercise', id: 'peer-bench' }, options);
    expect(ex.data.exercises).toHaveLength(1);
    expect(ex.data.mappings).toHaveLength(1);
    expect(ex.data.routines).toEqual([]);
    expect(ex.data.programmes).toEqual([]);
    const r = createLibrary(data, { kind: 'routine', id: data.routines[0].id }, options);
    expect(r.data.routines[0].programmeId).toBeUndefined();
    expect(r.data.programmes).toEqual([]);
    expect(r.data.exercises).toHaveLength(2);
    expect(() => createLibrary(data, { kind: 'exercise', id: 'missing' }, options)).toThrow(
      'no longer exists',
    );
  });
  it('includes archived dependencies, excludes unrelated archived exercises and strips unexpected nested fields', () => {
    const data = libraryFixture();
    data.exercises.find((e) => e.id === 'peer-bench')!.archived = true;
    data.exercises[0].archived = true;
    Object.assign(data.exercises[0], { sessionHistory: 'PRIVATE runtime field' });
    Object.assign(
      data.exercises.find((e) => e.id === 'peer-bench')!,
      { sessionHistory: 'PRIVATE runtime field' },
    );
    const file = createLibrary(data, { kind: 'library' }, options);
    expect(file.data.exercises.find((e) => e.id === 'peer-bench')?.archived).toBe(false);
    expect(file.data.exercises.some((e) => e.id === data.exercises[0].id)).toBe(false);
    expect(JSON.stringify(file)).not.toContain('PRIVATE');
  });
  it('rejects backups, unknown root data, unsupported versions, malformed/oversized and empty files', () => {
    expect(() => parseLibrary(serialise(libraryFixture()))).toThrow('Full backups');
    expect(() => parseLibrary(JSON.stringify({ ...share(), schemaVersion: 3 }))).toThrow(
      'version 1',
    );
    expect(() =>
      parseLibrary(JSON.stringify({ ...share(), data: { ...share().data, sessions: [] } })),
    ).toThrow('Full backups');
    expect(() => parseLibrary('{')).toThrow('valid JSON');
    expect(() => parseLibrary(' '.repeat(LIBRARY_LIMIT + 1))).toThrow('10 MB');
    const file = share();
    file.data = { exercises: [], mappings: [], routines: [], programmes: [] };
    expect(() => parseLibrary(JSON.stringify(file))).toThrow('empty');
  });
  it('rejects broken references, repeated identifiers, muscle mappings, incompatible metrics and rep ranges', () => {
    const mutations: Array<(f: ReturnType<typeof share>) => void> = [
      (f) => {
        f.data.exercises = [];
      },
      (f) => {
        f.data.programmes = [];
      },
      (f) => {
        f.data.routines[0].items[0].groupId = 'missing';
      },
      (f) => {
        f.data.routines[0].items[0].sets[0].groupId = 'missing';
      },
      (f) => {
        f.data.exercises.push(f.data.exercises[0]);
      },
      (f) => {
        f.data.mappings.push({ ...f.data.mappings[0], id: 'another-mapping' });
      },
      (f) => {
        f.data.routines[0].items[0].tracking = 'duration';
      },
      (f) => {
        f.data.exercises[0].repMin = 999;
      },
      (f) => {
        f.data.routines[0].items[0].repMin = 999;
      },
    ];
    for (const mutate of mutations) {
      const file = share();
      mutate(file);
      expect(() => parseLibrary(JSON.stringify(file))).toThrow();
    }
  });
});

describe('matching and import previews', () => {
  it('reuses equivalent exercises with different IDs while preserving local definitions and mappings', () => {
    const file = share();
    const data = libraryFixture();
    const e = data.exercises.find((e) => e.id === 'peer-bench')!;
    e.id = 'my-bench';
    e.name = '  PEER   BENCH PRESS  ';
    e.notes = 'Keep my note';
    const preview = previewLibrary(file, data);
    expect(preview.additions.exercises).toEqual([]);
    expect(preview.additions.mappings).toEqual([]);
    expect(preview.additions.routines[0].items[0].exerciseId).toBe('my-bench');
    expect(e.notes).toBe('Keep my note');
  });
  it('creates distinct definitions for same source IDs with different equipment or tracking', () => {
    const data = libraryFixture();
    data.exercises.find((e) => e.id === 'peer-bench')!.equipment = 'Smith machine';
    const preview = previewLibrary(share(), data);
    expect(preview.additions.exercises).toHaveLength(1);
    expect(preview.additions.exercises[0].id).not.toBe('peer-bench');
    expect(preview.additions.routines[0].items[0].exerciseId).toBe(
      preview.additions.exercises[0].id,
    );
  });
  it('ignores JSON key ordering, IDs and schedule/color metadata when matching routine content', () => {
    const file = share();
    const data = libraryFixture();
    const r = data.routines[0];
    r.id = 'my-routine';
    r.weekdays = [1];
    r.color = '#123456';
    const before = JSON.stringify(data);
    const preview = previewLibrary(file, data, true);
    expect(preview.additions.routines).toEqual([]);
    expect(JSON.stringify(data)).toBe(before);
    r.items[0].sets[0].reps = 7;
    expect(previewLibrary(file, data).additions.routines).toHaveLength(1);
  });
  it('imports schedules only on request and remaps every exercise, item and group reference', () => {
    const file = share();
    const data = structuredClone(emptyData);
    const preview = previewLibrary(file, data);
    const r = preview.additions.routines[0];
    expect(r.weekdays).toEqual([]);
    expect(previewLibrary(file, data, true).additions.routines[0].weekdays).toEqual([4]);
    expect(r.id).not.toBe(file.data.routines[0].id);
    expect(r.items[0].id).not.toBe(file.data.routines[0].items[0].id);
    expect(r.items[0].groupId).toBe(r.groups[0].id);
    expect(r.items[0].sets[1].groupId).toBe(r.groups[0].id);
    expect(r.programmeId).toBe(preview.additions.programmes[0].id);
    expect(
      r.items.every((i) => preview.additions.exercises.some((e) => e.id === i.exerciseId)),
    ).toBe(true);
  });
});

describe('atomic library imports', () => {
  let db: TrainingDB;
  beforeEach(async () => {
    db = new TrainingDB('library-test-' + uid());
    await db.open();
  });
  afterEach(async () => {
    await db.delete();
  });
  const personal = (data: Data) => ({
    sessions: data.sessions,
    sets: data.sets,
    plans: data.plans,
    bodyweights: data.bodyweights,
    settings: data.settings,
    timer: data.timer,
  });
  it('adds only library content, preserves active/history/measurements/settings and is repeatable after local edits', async () => {
    const own = fixture();
    own.sessions[0].status = 'active';
    own.sessions[0].endAt = undefined;
    own.bodyweights = libraryFixture().bodyweights;
    own.timer = {
      id: 'rest',
      durationMs: 90000,
      exerciseName: 'My timer',
      notified: false,
      endAt: Date.now() + 90000,
    };
    await importBackup(parseBackup(serialise(own)), 'replace', db);
    const before = await readData(db);
    const backups = await db.backups.toArray();
    const first = await importLibrary(share(), false, db);
    expect(first).toEqual({ added: 3, reused: 1 });
    const after = await readData(db);
    expect(personal(after)).toEqual(personal(before));
    for (const e of before.exercises) expect(after.exercises.find((x) => x.id === e.id)).toEqual(e);
    for (const r of before.routines) expect(after.routines.find((x) => x.id === r.id)).toEqual(r);
    const imported = after.routines.find((r) => r.name === 'Peer upper routine')!;
    await db.routines.update(imported.id, { name: 'My edited routine' });
    const importedEx = after.exercises.find((e) => e.name === 'Peer bench press')!;
    await db.exercises.update(importedEx.id, { name: 'My edited bench', notes: 'Local edits' });
    expect(await importLibrary(share(), true, db)).toEqual({ added: 0, reused: 4 });
    expect((await db.routines.get(imported.id))?.name).toBe('My edited routine');
    expect((await db.exercises.get(importedEx.id))?.notes).toBe('Local edits');
    expect(await db.backups.toArray()).toEqual(backups);
    expect(personal(await readData(db))).toEqual(personal(before));
    parseBackup(serialise(await readData(db)));
  });
  it('rolls back definitions, mappings and programmes if routine persistence fails', async () => {
    const before = await readData(db);
    const fail = () => {
      throw Error('Simulated storage failure');
    };
    db.routines.hook('creating', fail);
    await expect(importLibrary(share(), true, db)).rejects.toThrow('Simulated storage failure');
    db.routines.hook('creating').unsubscribe(fail);
    expect(await readData(db)).toEqual(before);
  });
  it('revalidates direct imports before writing anything', async () => {
    const before = await readData(db);
    const file = share();
    file.data.routines[0].items[0].exerciseId = 'missing';
    await expect(importLibrary(file, false, db)).rejects.toThrow();
    expect(await readData(db)).toEqual(before);
  });
});
