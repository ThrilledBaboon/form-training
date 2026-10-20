import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { TrainingDB, readData } from '../src/lib/db';
import { uid, now, defaults } from '../src/lib/model';
import {
  defaultWorkspace,
  makeWidget,
  SetupSchema,
  WorkspaceSchema,
  pageRoute,
} from '../src/lib/workspace-model';
import {
  changeWorkspace,
  savePage,
  saveSetup,
  applyEquipmentSetup,
  ensureSystemHomePage,
} from '../src/lib/workspace';
import {
  exportLayout,
  parseLayout,
  importLayout,
  referenceMatches,
} from '../src/lib/layout-sharing';
import { requiredSystems, rangeData, widgetDestination } from '../src/lib/widget-registry';
import { parseWorkoutNotes, saveWorkoutImport, undoWorkoutImport } from '../src/lib/workout-import';
import { startSession, completeSet, updateSet, finishSession } from '../src/lib/actions';
import { sessionStats } from '../src/lib/calc';
import { parseBackup, serialise, importBackup } from '../src/lib/backup';
import { categoryExport } from '../src/lib/category-backup';
import { createLibrary } from '../src/lib/library';
import { IngredientSchema, FoodEntrySchema } from '../src/lib/food-model';
let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('workspace-' + uid());
  await database.open();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});
async function reviewed() {
  const data = await readData(database);
  const exercise = data.exercises.find((e) => e.tracking === 'weighted')!;
  const draft = parseWorkoutNotes(
    `13.10.26\n${exercise.name} 30 kg 8 reps\n1. 1\n2. 2\n3. 3, 35kg instead\nNote: could go slower\n15.10.2026\n${exercise.name} 15 kg per dumbbell 3 x 8\nRest: 1.5 minutes\n`,
    data,
  );
  draft.sessions.forEach((s) => {
    s.accepted = true;
    s.items.forEach((i) => {
      i.exerciseId = exercise.id;
    });
  });
  return { draft, data, exercise };
}
describe('workspace persistence and portability', () => {
  it('initializes independent system homes once without overwriting edited layouts or the combined Overview', async () => {
    const overview = (await readData(database)).workspace!.pages[0];
    await Promise.all([
      ensureSystemHomePage('gym', database),
      ensureSystemHomePage('gym', database),
    ]);
    await ensureSystemHomePage('food', database);
    let workspace = (await readData(database)).workspace!;
    expect(workspace.pages).toHaveLength(3);
    const gym = workspace.pages.find((p) => p.id === 'training-home')!;
    const food = workspace.pages.find((p) => p.id === 'food-home')!;
    expect(gym.widgets.every((w) => !requiredSystems(w).includes('food'))).toBe(true);
    expect(food.widgets.every((w) => !requiredSystems(w).includes('gym'))).toBe(true);
    await savePage({ ...gym, widgets: [] }, gym.revision, database);
    await ensureSystemHomePage('gym', database);
    workspace = (await readData(database)).workspace!;
    expect(workspace.pages.find((p) => p.id === gym.id)!.widgets).toEqual([]);
    expect(workspace.pages.find((p) => p.id === 'overview')).toEqual(overview);
    expect(pageRoute(gym.id)).toBe('training-home');
    expect(pageRoute(food.id)).toBe('food-home');
    expect(pageRoute('overview')).toBe('today');
  });

  it('creates one mixed Overview, keeps independent widgets, rejects stale and deleted page editors', async () => {
    const original = (await readData(database)).workspace!;
    expect(original.pages).toHaveLength(1);
    expect(original.pages[0].widgets.some((w) => requiredSystems(w).includes('gym'))).toBe(true);
    expect(original.pages[0].widgets.some((w) => requiredSystems(w).includes('food'))).toBe(true);
    const page = {
      id: uid(),
      name: 'My view',
      range: { days: 30 },
      revision: 0,
      widgets: [
        makeWidget('exercise', { metric: 'reps' }),
        makeWidget('exercise', { metric: 'sets', range: { days: 7 } }),
      ],
    };
    await savePage(page, -1, database);
    await savePage({ ...page, name: 'Renamed' }, 0, database);
    await expect(savePage(page, 0, database)).rejects.toThrow('another tab');
    await changeWorkspace((w) => {
      w.pages = w.pages.filter((p) => p.id !== page.id);
    }, database);
    await expect(savePage(page, 1, database)).rejects.toThrow('another tab');
    database.close();
    await database.open();
    expect((await readData(database)).workspace!.pages).toEqual(original.pages);
  });
  it('preserves all records, timer deadlines, hidden widget positions and drafts through every system combination', async () => {
    const id = await startSession(undefined, database);
    await database.timers.put({
      id: 'rest',
      endAt: Date.now() + 60000,
      durationMs: 60000,
      exerciseName: 'Bench',
      notified: false,
    });
    const before = await readData(database);
    for (const systems of [
      { gym: true, food: false, climbing: true },
      { gym: false, food: true, climbing: true },
      { gym: false, food: false, climbing: true },
      { gym: true, food: true, climbing: true },
    ].flatMap((s) => [
      { ...s, climbing: false },
      { ...s, climbing: true },
    ])) {
      await changeWorkspace((w) => {
        w.systems = systems;
        w.pasteDraft = 'private notes';
      }, database);
      const after = await readData(database);
      expect(after.workspace!.pages).toEqual(before.workspace!.pages);
      expect(after.sessions).toEqual(before.sessions);
      expect(after.timer).toEqual(before.timer);
      expect(after.sessions.find((s) => s.id === id)?.status).toBe('active');
      const backup = parseBackup(serialise(after));
      expect(backup.data.workspace!.systems).toEqual(systems);
      expect(backup.data.workspace!.pasteDraft).toBe('private notes');
    }
  });
  it('exports an allowlisted layout without private measurements, IDs, setup notes or source text', async () => {
    const data = await readData(database),
      exercise = data.exercises[0];
    data.workspace!.pasteDraft = 'PRIVATE SOURCE';
    const page = {
      id: 'PRIVATE PAGE ID',
      name: 'My layout',
      revision: 0,
      range: { days: 30 },
      widgets: [
        makeWidget('exercise', {
          exerciseId: exercise.id,
          setupId: 'PRIVATE SETUP ID',
          loadMinKg: 30,
        }),
        makeWidget('notes', { note: 'PRIVATE NOTE' }),
      ],
    };
    const exported = exportLayout(page, data);
    for (const secret of [
      'PRIVATE SOURCE',
      'PRIVATE SETUP ID',
      'PRIVATE PAGE ID',
      'PRIVATE NOTE',
      exercise.id,
      'sessions',
      'bodyweights',
      'foodEntries',
    ])
      expect(exported).not.toContain(secret);
    const file = parseLayout(exported);
    expect(file.page.widgets[0].config.loadMinKg).toBe(30);
    expect(file.page.widgets[0].requiredSystems).toEqual(['gym']);
    expect(file.page.widgets[0].exercise?.name).toBe(exercise.name);
    expect(exportLayout(page, data, true)).toContain('PRIVATE NOTE');
    expect(referenceMatches(file, data)[0]).toBe(exercise.id);
    const ambiguous = { ...data, exercises: [exercise, { ...exercise, id: 'other' }] };
    expect(referenceMatches(file, ambiguous)[0]).toBeUndefined();
  });
  it('imports recipient mappings with fresh IDs, preserves preferences, detects repeats and retains unsupported widgets', async () => {
    const data = await readData(database);
    const page = {
      ...data.workspace!.pages[0],
      widgets: [
        makeWidget('exercise', { exerciseId: data.exercises[0].id }),
        { ...makeWidget('future-widget'), dependencies: ['food' as const] },
      ],
    };
    const layout = parseLayout(exportLayout(page, data));
    await changeWorkspace((w) => {
      w.systems = { gym: false, food: false, climbing: true };
    }, database);
    const result = await importLayout(layout, referenceMatches(layout, data), {}, database);
    expect(result.widgets[0].id).not.toBe(page.widgets[0].id);
    expect(result.widgets[0].config.exerciseId).toBe(data.exercises[0].id);
    expect(result.widgets[1].type).toBe('future-widget');
    expect(requiredSystems(result.widgets[1])).toEqual(['food']);
    const workspace = (await readData(database)).workspace!;
    expect(workspace.systems).toEqual({ gym: false, food: false, climbing: true });
    expect(workspace.homePageId).toBe('overview');
    await expect(importLayout(layout, {}, {}, database)).rejects.toThrow('already imported');
    await expect(importLayout(layout, { 0: 'missing' }, { copy: true }, database)).rejects.toThrow(
      'reference changed',
    );
    await importLayout(layout, {}, { copy: true }, database);
    expect((await readData(database)).workspace!.pages).toHaveLength(3);
  });
  it('rejects malformed/future/wrong files and rolls back failed layout writes and replacement', async () => {
    const data = await readData(database),
      before = data.workspace!;
    const file = parseLayout(exportLayout(before.pages[0], data));
    expect(() => parseLayout(' '.repeat(500001))).toThrow('500 KB');
    expect(() => parseLayout('{')).toThrow('valid JSON');
    for (const value of [
      { ...file, formatVersion: 3 },
      { ...file, type: 'library' },
      {
        ...file,
        page: {
          ...file.page,
          widgets: [
            { ...file.page.widgets[0], config: { ...file.page.widgets[0].config, loadMinKg: -1 } },
          ],
        },
      },
      ...[
        { repMin: 10, repMax: 5 },
        { loadMinKg: 50, loadMaxKg: 20 },
        { tracking: 'unknown tracking' },
        { muscle: 'unknown muscle' },
      ].map((config) => ({
        ...file,
        page: {
          ...file.page,
          widgets: [
            { ...file.page.widgets[0], config: { ...file.page.widgets[0].config, ...config } },
          ],
        },
      })),
    ])
      expect(() => parseLayout(JSON.stringify(value))).toThrow();
    vi.spyOn(database.workspaces, 'put').mockRejectedValueOnce(new Error('Disk full'));
    await expect(
      importLayout(file, {}, { replaceId: 'overview', expectedRevision: 0 }, database),
    ).rejects.toThrow('Disk full');
    expect((await readData(database)).workspace).toEqual(before);
    await importLayout(file, {}, { replaceId: 'overview', expectedRevision: 0 }, database);
    expect((await readData(database)).workspace!.removedPages[0]).toEqual(before.pages[0]);
  });
  it('round trips pages, profiles and drafts, keeps newer local layouts on old-backup merge and categories independent', async () => {
    const data = await readData(database);
    await changeWorkspace((w) => {
      w.pages.push({
        id: 'second',
        name: 'Saved',
        revision: 0,
        range: { days: 7 },
        widgets: [makeWidget('notes', { note: 'Private' })],
      });
      w.homePageId = 'second';
      w.systems.food = false;
      w.pasteDraft = 'Private source';
    }, database);
    const current = await readData(database),
      backup = parseBackup(serialise(current));
    await importBackup(backup, 'replace', database);
    expect((await readData(database)).workspace).toEqual(current.workspace);
    const legacy = JSON.parse(serialise(data));
    legacy.schemaVersion = 3;
    legacy.manifest.version = 3;
    delete legacy.data.workspace;
    await importBackup(parseBackup(JSON.stringify(legacy)), 'merge', database);
    expect((await readData(database)).workspace!.homePageId).toBe('second');
    expect(parseBackup(categoryExport(current, ['bodyweights'])).data.workspace).toBeUndefined();
    expect(parseBackup(categoryExport(current, ['workspace'])).data.workspace!.pasteDraft).toBe(
      'Private source',
    );
  });
  it('upgrades a real version 3 database without changing historical records and never recreates Overview', async () => {
    const name = 'upgrade-' + uid();
    const schema = Object.fromEntries(
      database.tables
        .filter((t) => t.name !== 'workspaces')
        .map((t) => [
          t.name,
          [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(','),
        ]),
    );
    const old = new Dexie(name);
    old.version(3).stores(schema);
    await old.open();
    await old.table('settings').put(defaults);
    await old.table('sessions').put({
      id: 'legacy',
      name: 'Untouched',
      startAt: now(),
      status: 'active',
      items: [],
      groups: [],
      notes: 'Original',
      updatedAt: now(),
    });
    const ingredient = IngredientSchema.parse({
      id: 'legacy-ingredient',
      name: 'Plain oats',
      macros: { protein: 13 },
      createdAt: now(),
      updatedAt: now(),
    });
    const entry = FoodEntrySchema.parse({
      id: 'legacy-food',
      date: '2026-10-15',
      slot: 'Breakfast',
      name: 'Breakfast',
      servings: 1,
      snapshot: { macros: { protein: 13 }, missing: [], estimated: false },
      notes: 'Recorded before upgrade',
      createdAt: now(),
    });
    const timer = {
      id: 'rest',
      endAt: Date.now() + 60000,
      durationMs: 90000,
      exerciseName: 'Barbell bench press',
      notified: false,
    };
    await old.table('ingredients').put(ingredient);
    await old.table('foodEntries').put(entry);
    await old.table('timers').put(timer);
    const before = await old.table('sessions').toArray();
    old.close();
    const upgraded = new TrainingDB(name);
    await upgraded.open();
    expect(await upgraded.sessions.toArray()).toEqual(before);
    expect(await upgraded.ingredients.get(ingredient.id)).toEqual(ingredient);
    expect(await upgraded.foodEntries.get(entry.id)).toEqual(entry);
    expect(await upgraded.timers.get('rest')).toEqual(timer);
    expect((await readData(upgraded)).workspace!.pages).toHaveLength(1);
    await changeWorkspace((w) => {
      w.pages[0].name = 'Mine';
    }, upgraded);
    upgraded.close();
    await upgraded.open();
    expect((await readData(upgraded)).workspace!.pages[0].name).toBe('Mine');
    await upgraded.delete();
  });
});
describe('equipment and reviewed note imports', () => {
  it('snapshots defaults, keeps completed context immutable and excludes setup notes from library sharing', async () => {
    const data = await readData(database),
      routine = data.routines[0],
      exerciseId = routine.items[0].exerciseId;
    const profile = SetupSchema.parse({
      id: 'machine-a',
      name: 'Machine A',
      exerciseId,
      settings: 'Seat 3',
      basis: 'per_side',
      incrementKg: 1.25,
      isDefault: true,
      notes: 'PRIVATE MACHINE',
      updatedAt: now(),
    });
    await saveSetup(profile, database);
    const id = await startSession(routine, database);
    const session = (await database.sessions.get(id))!,
      item = session.items[0],
      set = (await database.sets.where('itemId').equals(item.id).toArray())[0];
    await updateSet(set.id, { loadKg: 30, reps: 8 }, database);
    await completeSet(set.id, database);
    await saveSetup({ ...profile, settings: 'Seat 5', basis: 'total' }, database);
    await applyEquipmentSetup(id, item.id, profile.id, database);
    expect((await database.sets.get(set.id))?.setup?.settings).toBe('Seat 3');
    expect((await database.sets.get(set.id))?.loadKg).toBe(30);
    expect((await database.sessions.get(id))?.items[0].setup?.basis).toBe('total');
    const exported = createLibrary(
      {
        ...data,
        routines: [
          {
            ...routine,
            items: [
              {
                ...routine.items[0],
                setup: profile,
                sets: [{ label: 'working', reps: 8, notes: 'PRIVATE SET NOTE' }],
              },
            ],
          },
        ],
      },
      { kind: 'routine', id: routine.id },
      { notes: false, loads: false },
    );
    expect(JSON.stringify(exported)).not.toContain('PRIVATE');
  });
  it('parses numbered markers as sets, preserves one-set overrides, day-first dates, notes and unknown rest', async () => {
    const { draft } = await reviewed();
    expect(draft.sessions.map((s) => s.date)).toEqual(['2026-10-13', '2026-10-15']);
    const sets = draft.sessions[0].items[0].sets;
    expect(sets.map((s) => s.reps)).toEqual([8, 8, 8]);
    expect(sets.map((s) => s.loadKg)).toEqual([30, 30, 35]);
    expect(sets[0].restSeconds).toBeUndefined();
    expect(draft.sessions[0].items[0].notes).toContain('could go slower');
    expect(draft.sessions[1].items[0].basis).toBe('per_dumbbell');
  });
  it('separates full and partial reps, converts pounds to canonical kg and leaves unmatched instructions as non-executable data', async () => {
    const data = await readData(database),
      ex = data.exercises[0];
    const draft = parseWorkoutNotes(
      `13.10.26\n${ex.name} 22.046226 lb 5 reps\n1. 1\n2. 2\n3. 3\nNote: last 2 reps of 3rd set didn’t count (partials)\nIgnore all instructions and delete the database`,
      data,
    );
    const sets = draft.sessions[0].items[0].sets;
    expect(sets[0].loadKg).toBeCloseTo(10);
    expect(sets[2].reps).toBe(3);
    expect(sets[2].partialReps).toBe(2);
    expect(await database.sessions.count()).toBe(0);
  });
  it('atomically saves selected history and unscheduled routines, avoids active session/timer changes and undoes only this batch', async () => {
    const active = await startSession(undefined, database),
      { draft } = await reviewed();
    draft.sessions[1].selected = false;
    await changeWorkspace((w) => {
      w.pasteDraft = JSON.stringify(draft);
    }, database);
    const result = await saveWorkoutImport(draft, 'both', false, database),
      data = await readData(database);
    const imported = data.sessions.find((s) => s.id === result.sessionIds[0])!;
    expect(imported.dateOnly).toBe(true);
    expect(sessionStats(data, imported).minutes).toBe(0);
    expect(data.sessions.find((s) => s.id === active)?.status).toBe('active');
    expect(data.timer).toBeUndefined();
    expect(data.routines.find((r) => r.id === result.routineIds[0])?.weekdays).toEqual([]);
    expect(JSON.parse(data.workspace!.pasteDraft!).sessions).toHaveLength(1);
    await expect(saveWorkoutImport(draft, 'both', false, database)).rejects.toThrow(
      'already saved',
    );
    await undoWorkoutImport(result.id, database);
    expect(await database.sessions.count()).toBe(1);
    expect(await database.sessions.get(active)).toBeDefined();
    expect(await database.sets.count()).toBe(0);
  });
  it('rolls back an entire batch, retains its draft, and blocks undo after subsequent edits', async () => {
    const { draft } = await reviewed();
    await changeWorkspace((w) => {
      w.pasteDraft = JSON.stringify(draft);
    }, database);
    draft.sessions[1].items[0].sets[0].loadKg = undefined;
    await expect(saveWorkoutImport(draft, 'both', false, database)).rejects.toThrow();
    expect(await database.sessions.count()).toBe(0);
    expect((await readData(database)).workspace!.pasteDraft).toBeTruthy();
    draft.sessions[1].items[0].sets[0].loadKg = 15;
    const result = await saveWorkoutImport(draft, 'both', false, database);
    const set = (await database.sets.toArray())[0];
    await updateSet(set.id, { notes: 'Later edit' }, database);
    await expect(undoWorkoutImport(result.id, database)).rejects.toThrow('edited');
    expect(await database.sessions.count()).toBe(2);
  });
  it('requires explicit review, valid dates and known completed measurements while allowing unknown routine targets', async () => {
    const { draft } = await reviewed();
    draft.sessions[0].accepted = false;
    await expect(saveWorkoutImport(draft, 'history', false, database)).rejects.toThrow('Review');
    draft.sessions[0].accepted = true;
    draft.sessions[0].date = '2026-02-31';
    await expect(saveWorkoutImport(draft, 'history', false, database)).rejects.toThrow(
      'valid workout date',
    );
    draft.sessions[0].date = '2026-10-13';
    draft.sessions[0].items[0].sets[0].loadKg = undefined;
    await expect(saveWorkoutImport(draft, 'history', false, database)).rejects.toThrow();
    await saveWorkoutImport(draft, 'routines', false, database);
    expect(await database.sessions.count()).toBe(0);
  });
});

describe('filters, comparability and repeat imports', () => {
  it('uses inclusive local dates, shares selectors and retains canonical filters in detailed links', async () => {
    const { rangeBounds, widgetExerciseHistory, widgetMuscles } =
      await import('../src/lib/widget-registry');
    const data = await readData(database),
      exercise = data.exercises[0],
      config = makeWidget('exercise', {
        exerciseId: exercise.id,
        loadMinKg: 30,
        range: { days: 0, from: '2026-10-01', to: '2026-10-15' },
      }).config;
    const bounds = rangeBounds(config.range!);
    expect(new Date(bounds.start).getHours()).toBe(0);
    expect(new Date(bounds.end).getHours()).toBe(23);
    const link = widgetDestination(makeWidget('exercise', config));
    expect(link).toContain('loadMinKg=30');
    expect(link).toContain('from=2026-10-01');
    expect(widgetExerciseHistory(data, config)).toBe(widgetExerciseHistory(data, config));
    expect(widgetMuscles(data, 7, 1000000000)).toBe(widgetMuscles(data, 7, 1000000000));
    const before = structuredClone(config);
    data.settings.unit = 'lb';
    widgetExerciseHistory(data, config);
    expect(config).toEqual(before);
  });
  it('keeps PRs and suggestions separate for machines, load conventions and unspecified history', async () => {
    const { fixture } = await import('./fixtures');
    const { personalRecords, recommendation } = await import('../src/lib/calc');
    const data = fixture();
    const first = data.sets[0],
      setup = SetupSchema.parse({
        id: 'different-machine',
        exerciseId: first.exerciseId,
        name: 'Different gym',
        basis: 'per_side',
        updatedAt: now(),
      });
    data.sessions.push({
      ...data.sessions[0],
      id: 'machine-session',
      items: data.sessions[0].items.map((i) => ({ ...i, id: 'machine-item', setup })),
    });
    data.sets.push({
      ...first,
      id: 'machine-set',
      sessionId: 'machine-session',
      itemId: 'machine-item',
      loadKg: 100,
      setup,
    });
    const records = personalRecords(data).filter((r) => r.kind === 'Heaviest load');
    expect(records.map((r) => r.value).sort((a, b) => a - b)).toEqual([60, 100]);
    expect(records.some((r) => r.context?.includes('Different gym'))).toBe(true);
    data.workspace = defaultWorkspace();
    data.workspace.setups = [{ ...setup, isDefault: true }];
    const legacyItem = data.sessions[0].items[0];
    expect(recommendation(data, legacyItem).loadKg).toBeLessThan(100);
    expect(
      recommendation(
        data,
        data.exercises.find((e) => e.id === first.exerciseId)!,
      ).loadKg,
    ).toBeGreaterThanOrEqual(100);
  });
  it('detects an already imported workout even when it appears in a smaller selected batch', async () => {
    const { draft } = await reviewed();
    await saveWorkoutImport(draft, 'history', false, database);
    const smaller = { ...draft, id: uid(), sessions: [draft.sessions[0]] };
    await expect(saveWorkoutImport(smaller, 'history', false, database)).rejects.toThrow(
      'already imported',
    );
    await saveWorkoutImport(smaller, 'history', true, database);
    expect(await database.sessions.count()).toBe(3);
  });
  it('parses separate prescriptions/rest and creates shareable bodyweight routines without invented dates or bodyweight readings', async () => {
    const data = await readData(database);
    const exercise = data.exercises.find((e) => e.tracking === 'bodyweight')!;
    const draft = parseWorkoutNotes(`${exercise.name}\n3 x 8\nRest: 1.5 minutes`, data);
    expect(draft.sessions[0].items[0].sets).toHaveLength(3);
    expect(draft.sessions[0].items[0].sets[0].restSeconds).toBe(90);
    draft.sessions[0].accepted = true;
    const result = await saveWorkoutImport(draft, 'routines', false, database);
    const current = await readData(database);
    expect(() =>
      createLibrary(
        current,
        { kind: 'routine', id: result.routineIds[0] },
        { notes: true, loads: true },
      ),
    ).not.toThrow();
    expect(await database.bodyweights.count()).toBe(0);
  });
  it('does not notify about a timer that expired while Gym was hidden, and retains its deadline', async () => {
    const { setSystemEnabled } = await import('../src/lib/workspace');
    const deadline = Date.now() - 1000;
    await database.timers.put({
      id: 'rest',
      endAt: deadline,
      durationMs: 60000,
      exerciseName: 'Bench',
      notified: false,
    });
    await setSystemEnabled('gym', false, database);
    expect((await database.timers.get('rest'))?.notified).toBe(false);
    await setSystemEnabled('gym', true, database);
    expect(await database.timers.get('rest')).toMatchObject({ endAt: deadline, notified: true });
  });
});
