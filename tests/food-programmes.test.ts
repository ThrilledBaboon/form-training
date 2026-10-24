import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { TrainingDB, readData } from '../src/lib/db';
import { defaults, now, uid } from '../src/lib/model';
import { FoodScheduleSchema, type FoodSchedule } from '../src/lib/food-model';
import { fillingBowlStarter } from '../src/lib/food-programme-starter';
import {
  foodProgrammeLibrary,
  importFoodProgrammeLibrary,
  parseFoodProgrammeLibrary,
  programmeImportPreview,
} from '../src/lib/food-programme-library';
import {
  programmeMeals,
  programmePreview,
  startFoodSchedule,
  fillFoodSchedule,
  changeFoodSchedule,
  checkInMeal,
  quickMealEntry,
  activeFoodSchedule,
  saveComposition,
} from '../src/lib/food-programmes';
import { foodDay, dailyMacros, recipeNutrition, shiftDay } from '../src/lib/food-calc';
import {
  saveMealPlan,
  deleteMealPlan,
  regenerateShopping,
  saveFoodEntry,
  removeFoodEntry,
} from '../src/lib/food-actions';
import { serialise, parseBackup, importBackup } from '../src/lib/backup';
import { categoryExport, foodCsv } from '../src/lib/category-backup';
import { getImportPrompt } from '../src/lib/import-prompts';
import { foodFixture } from './food-fixture';
import { suggestMeals } from '../src/lib/meal-suggestions';
import { saveFoodDraft } from '../src/lib/food-actions';
import { readFoodDraft } from '../src/lib/food-model';
let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('programme-' + uid());
  await database.open();
});
afterEach(async () => {
  await database.delete();
});
async function install() {
  const library = fillingBowlStarter();
  await importFoodProgrammeLibrary(library, false, database);
  return library;
}
function schedule(overrides: Partial<FoodSchedule> = {}) {
  const programme = fillingBowlStarter().programmes[0];
  return FoodScheduleSchema.parse({
    id: 'schedule-test',
    programmeId: programme.id,
    snapshot: programme,
    start: foodDay(),
    days: 30,
    slots: ['Breakfast', 'Lunch', 'Dinner'],
    status: 'active',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  });
}
async function food() {
  return (await readData(database)).food!;
}
describe('food programmes and unmeasured meals', () => {
  it('installs the complete starter idempotently without activating, logging, stock or setting changes', async () => {
    const library = await install();
    const before = await food();
    expect(library.recipes.length).toBe(18);
    expect(library.programmes[0].rotation).toHaveLength(21);
    expect(await importFoodProgrammeLibrary(library, false, database)).toBe(0);
    expect((await food()).recipes.length).toBe(18);
    expect(before.foodSchedules).toEqual([]);
    expect(before.foodEntries).toEqual([]);
    expect(before.stock).toEqual([]);
    expect(before.foodSettings.showCalories).toBe(false);
  });
  it('generates 90 dated meals, cycles days 29/30 correctly and uses calendar dates across DST/leap day', async () => {
    await install();
    const data = await food();
    const rows = programmeMeals(data, schedule({ start: '2026-10-20' }));
    expect(rows).toHaveLength(90);
    expect(rows[0].date).toBe('2026-10-20');
    expect(rows.at(-1)?.date).toBe('2026-11-18');
    expect(rows[84].recipeId).toBe(rows[0].recipeId);
    expect(rows[87].recipeId).toBe(rows[3].recipeId);
    expect(
      programmeMeals(data, schedule({ start: '2028-02-28', days: 3 })).map((p) => p.date),
    ).toContain('2028-02-29');
  });
  it('preserves occupied slots and swaps, repeated generation and deliberately deleted occurrences', async () => {
    const library = await install();
    const date = foodDay();
    await saveMealPlan(
      {
        id: 'manual',
        date,
        slot: 'Breakfast',
        recipeId: library.recipes[1].id,
        servings: 1,
        notes: 'Keep me',
        createdAt: now(),
      },
      database,
    );
    expect(programmePreview(await food(), schedule()).filter((r) => r.conflict)).toHaveLength(1);
    await startFoodSchedule(schedule(), database);
    expect((await food()).mealPlans).toHaveLength(90);
    const plan = (await food()).mealPlans.find((p) => p.scheduleId)!;
    await expect(saveMealPlan({ ...plan, id: 'duplicate-occurrence' }, database)).rejects.toThrow(
      'already planned',
    );
    await saveMealPlan({ ...plan, recipeId: library.recipes[0].id }, database);
    expect(await fillFoodSchedule('schedule-test', undefined, database)).toBe(0);
    expect((await database.mealPlans.get(plan.id))?.recipeId).toBe(library.recipes[0].id);
    await deleteMealPlan(plan.id, database);
    expect(await fillFoodSchedule('schedule-test', undefined, database)).toBe(0);
    expect(await database.mealPlans.get('manual')).toMatchObject({ notes: 'Keep me' });
  });
  it('blocks overlapping schedules, pauses/resumes without changing saved plans or calorie preferences', async () => {
    await install();
    await startFoodSchedule(schedule(), database);
    await expect(startFoodSchedule(schedule({ id: 'other' }), database)).rejects.toThrow('overlap');
    const count = (await food()).mealPlans.length;
    await changeFoodSchedule('schedule-test', { status: 'paused' }, database);
    expect(activeFoodSchedule(await food())).toBeUndefined();
    expect((await food()).mealPlans.length).toBe(count);
    await expect(fillFoodSchedule('schedule-test', undefined, database)).rejects.toThrow('active');
    await changeFoodSchedule('schedule-test', { status: 'active' }, database);
    expect(activeFoodSchedule(await food())?.id).toBe('schedule-test');
  });
  it('quick-checks in once, stays unknown, preserves a snapshot when a recipe changes and undoes without stock movements', async () => {
    await install();
    await startFoodSchedule(schedule(), database);
    const plan = (await food()).mealPlans[0];
    const [a, b] = await Promise.all([
      checkInMeal(plan, {}, database),
      checkInMeal(plan, {}, database),
    ]);
    expect(a).toBe(b);
    let data = await food();
    expect(data.foodEntries).toHaveLength(1);
    expect(data.foodEntries[0].unmeasured).toBe(true);
    expect(foodCsv(data, 'diary').split('\r\n')[1].split('","')[4]).toBe('');
    expect(foodCsv(data, 'diary')).toContain('"unmeasured"');
    expect(foodCsv(data, 'mealPlans').split('\r\n')[1].split('","')[5]).toBe('');
    expect(dailyMacros(data, foodDay()).protein).toBeUndefined();
    expect(data.movements).toEqual([]);
    const composition = data.foodEntries[0].composition;
    const recipe = data.recipes.find((r) => r.id === plan.recipeId)!;
    await saveComposition(
      { ...recipe, name: 'Changed recipe', composition: recipe.composition!.slice(0, 1) },
      database,
    );
    await checkInMeal(plan, { entryId: a, notes: 'Historical correction' }, database);
    data = await food();
    expect(data.foodEntries[0].composition).toEqual(composition);
    expect(data.foodEntries[0].name).toBe(recipe.name);
    await removeFoodEntry(a, database);
    expect((await food()).foodEntries).toEqual([]);
    expect((await food()).movements).toEqual([]);
  });
  it('can confirm a quantified actual meal without double-counting or rewriting existing recipe totals', async () => {
    await install();
    const fixture = foodFixture();
    await database.ingredients.bulkPut(fixture.ingredients);
    await database.recipes.bulkPut(fixture.recipes);
    await startFoodSchedule(schedule(), database);
    const plan = (await food()).mealPlans[0];
    const id = await checkInMeal(plan, {}, database);
    await checkInMeal(
      plan,
      { entryId: id, recipeId: fixture.recipes[0].id, measured: true, servings: 2 },
      database,
    );
    const data = await food();
    expect(data.foodEntries).toHaveLength(1);
    expect(data.foodEntries[0].unmeasured).toBe(false);
    expect(dailyMacros(data, foodDay()).protein).toBe(48);
    expect(data.movements).toHaveLength(0);
  });
  it('does not treat an unmeasured meal or a partial known amount as zero nutrition', async () => {
    const library = await install();
    const data = await food();
    expect(recipeNutrition(data, library.recipes[0]).macros).toEqual({});
    const measured = foodFixture();
    await database.ingredients.bulkPut(measured.ingredients);
    await database.recipes.bulkPut(measured.recipes);
    await saveFoodEntry(
      quickMealEntry({ ...data, ...measured }, measured.recipes[0], {
        date: foodDay(),
        slot: 'Lunch',
        measured: true,
      }),
      database,
    );
    await saveFoodEntry(
      quickMealEntry(data, library.recipes[0], { date: foodDay(), slot: 'Breakfast' }),
      database,
    );
    expect(dailyMacros(await food(), foodDay()).protein).toBeUndefined();
  });
  it('generates a separate unmeasured shopping checklist and retains checked state across regeneration', async () => {
    await install();
    await startFoodSchedule(schedule(), database);
    const id = 'shopping';
    await database.shoppingLists.add({
      id,
      name: 'Week',
      from: foodDay(),
      to: shiftDay(foodDay(), 6),
      items: [],
      createdAt: now(),
      updatedAt: now(),
    });
    await regenerateShopping(id, database);
    const list = (await database.shoppingLists.get(id))!;
    expect(list.items).toEqual([]);
    expect(list.checklist!.length).toBeGreaterThan(10);
    const first = list.checklist![0];
    await database.shoppingLists.put({
      ...list,
      checklist: list.checklist!.map((r) => ({ ...r, checked: r.id === first.id })),
    });
    await regenerateShopping(id, database);
    expect(
      (await database.shoppingLists.get(id))?.checklist?.find((r) => r.id === first.id)?.checked,
    ).toBe(true);
    expect((await food()).stock).toHaveLength(0);
  });
  it('keeps known shopping demand alongside extra unmeasured demand without inventing totals', async () => {
    const starter = await install();
    const known = foodFixture();
    await database.ingredients.bulkPut(known.ingredients);
    const ingredientId = known.ingredients[0].id;
    const recipe = {
      ...starter.recipes[0],
      composition: [
        {
          ingredientId,
          role: 'other' as const,
          quantity: 100,
          unit: 'g' as const,
          state: known.ingredients[0].state,
          guidance: '',
        },
        {
          ingredientId,
          role: 'other' as const,
          state: known.ingredients[0].state,
          guidance: 'Extra to taste',
        },
      ],
    };
    await saveComposition(recipe, database);
    await saveMealPlan(
      {
        id: 'partial',
        date: foodDay(),
        slot: 'Lunch',
        recipeId: recipe.id,
        servings: 1,
        notes: '',
        createdAt: now(),
      },
      database,
    );
    await database.shoppingLists.add({
      id: 'mixed-list',
      name: 'Mixed',
      from: foodDay(),
      to: foodDay(),
      items: [],
      createdAt: now(),
      updatedAt: now(),
    });
    await regenerateShopping('mixed-list', database);
    const list = (await database.shoppingLists.get('mixed-list'))!;
    expect(list.items[0].shortage).toBe(100);
    expect(list.items[0].quantity).toBe(500); // One recorded package covers the known demand.
    expect(list.checklist?.map((i) => i.ingredientId)).toEqual([ingredientId]);
    expect(recipeNutrition(await food(), recipe).macros).toEqual({});
  });
  it('respects active exclusions in programme suggestions and rejects stale conflicting starts atomically', async () => {
    const library = await install();
    const excluded = library.recipes[0].composition![0].ingredientId;
    await startFoodSchedule(schedule({ exclusions: [excluded] }), database);
    const data = await food();
    const suggestions = suggestMeals(data, { programmeId: library.programmes[0].id });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(
      suggestions.every((s) => !s.recipe.composition?.some((l) => l.ingredientId === excluded)),
    ).toBe(true);
    const before = await database.mealPlans.count();
    await expect(startFoodSchedule(schedule({ id: 'stale-preview' }), database)).rejects.toThrow(
      'overlap',
    );
    expect(await database.mealPlans.count()).toBe(before);
    expect(await database.foodSchedules.count()).toBe(1);
  });
  it('retains incomplete safe editor drafts and clears only the saved editor', async () => {
    const library = await install();
    const draft = { ...library.recipes[0], name: '' };
    await saveFoodDraft(
      { id: 'bowl-editor', kind: 'bowl', json: JSON.stringify(draft), updatedAt: now() },
      database,
    );
    expect(
      readFoodDraft('bowl', (await database.foodDrafts.get('bowl-editor'))!.json),
    ).toMatchObject({ name: '' });
    await saveFoodDraft(
      { id: 'recipe-editor', kind: 'recipe', json: JSON.stringify(draft), updatedAt: now() },
      database,
    );
    await saveComposition({ ...draft, name: 'Saved bowl' }, database);
    expect(await database.foodDrafts.get('bowl-editor')).toBeUndefined();
    expect(await database.foodDrafts.get('recipe-editor')).toBeDefined();
  });
  it('exports only reusable dependencies, rejects malformed references and remaps conflicts without replacing local ingredients', async () => {
    const library = await install();
    await startFoodSchedule(schedule(), database);
    await checkInMeal((await food()).mealPlans[0], {}, database);
    const output = foodProgrammeLibrary(await food(), [library.programmes[0].id]);
    expect(Object.keys(output)).not.toContain('foodSchedules');
    expect(Object.keys(output)).not.toContain('foodEntries');
    expect(parseFoodProgrammeLibrary(JSON.stringify(output)).programmes).toHaveLength(1);
    const bad = structuredClone(output);
    bad.programmes[0].rotation[0].recipeIds = ['missing'];
    expect(() => parseFoodProgrammeLibrary(JSON.stringify(bad))).toThrow('missing meal');
    const conflict = structuredClone(output);
    conflict.ingredients[0].name = 'Different local product';
    expect(programmeImportPreview(await food(), conflict).some((p) => p.conflicts)).toBe(true);
    await expect(importFoodProgrammeLibrary(conflict, false, database)).rejects.toThrow('conflict');
    await importFoodProgrammeLibrary(conflict, true, database);
    expect((await database.ingredients.get(output.ingredients[0].id))?.name).toBe(
      output.ingredients[0].name,
    );
    expect((await food()).foodProgrammes).toHaveLength(2);
  });
  it('round-trips complete and selected categories including schedule snapshots and check-ins', async () => {
    await install();
    await startFoodSchedule(schedule(), database);
    await checkInMeal((await food()).mealPlans[0], {}, database);
    const data = await readData(database);
    const full = parseBackup(serialise(data));
    const duplicate = structuredClone(full);
    duplicate.data.food.mealPlans.push({
      ...duplicate.data.food.mealPlans[0],
      id: 'duplicate-plan',
    });
    expect(() => parseBackup(JSON.stringify(duplicate))).toThrow(
      'Duplicate planned programme meal',
    );
    expect(full.schemaVersion).toBe(7);
    expect(full.data.food.foodSchedules).toHaveLength(1);
    expect(full.data.food.foodEntries).toHaveLength(1);
    const selected = parseBackup(categoryExport(data, ['foodSchedules']));
    expect(selected.data.food.foodSchedules).toHaveLength(1);
    expect(selected.data.food.mealPlans).toHaveLength(90);
    expect(selected.data.food.foodEntries).toHaveLength(1);
    expect(selected.data.food.recipes.length).toBeGreaterThan(0);
    const recipes = parseBackup(categoryExport(data, ['recipes']));
    expect(recipes.data.food.ingredients.length).toBeGreaterThan(0);
    expect(recipes.data.food.foodSchedules).toHaveLength(0);
    await importBackup(full, 'replace', database);
    expect((await food()).foodEntries).toHaveLength(1);
  });
  it('reads existing v6 backups with empty programme fields and rejects unknown versions', async () => {
    const old = JSON.parse(serialise(await readData(database)));
    old.schemaVersion = 6;
    old.manifest.version = 6;
    delete old.data.food.foodProgrammes;
    delete old.data.food.foodSchedules;
    const parsed = parseBackup(JSON.stringify(old));
    expect(parsed.data.food.foodProgrammes).toEqual([]);
    expect(parsed.data.food.foodSchedules).toEqual([]);
    old.schemaVersion = 100;
    expect(() => parseBackup(JSON.stringify(old))).toThrow();
  });
  it('generates an import prompt whose synthetic example validates through the actual importer', async () => {
    const prompt = await getImportPrompt('food-programmes');
    const example = prompt
      .split('Example structure (synthetic, no personal data):\n')[1]
      .split('\n\nExact JSON Schema')[0];
    const library = parseFoodProgrammeLibrary(example);
    expect(library.programmes).toHaveLength(1);
    await importFoodProgrammeLibrary(library, false, database);
    expect((await food()).foodProgrammes).toHaveLength(1);
  });
  it('upgrades a real v6 database additively while preserving Food and personal settings', async () => {
    const name = 'legacy-programme-' + uid();
    const legacy = new Dexie(name);
    legacy.version(6).stores({
      ingredients: 'id',
      recipes: 'id',
      foodEntries: 'id,date',
      mealPlans: 'id,date',
      stock: 'id',
      movements: 'id',
      batches: 'id',
      purchases: 'id',
      shoppingLists: 'id',
      foodSettings: 'id',
      foodFiles: 'id',
      foodDrafts: 'id',
      practice: 'id',
      climbing: 'id',
      workspaces: 'id',
      exercises: 'id',
      mappings: 'id',
      routines: 'id',
      programmes: 'id',
      plans: 'id',
      sessions: 'id',
      sets: 'id',
      bodyweights: 'id',
      settings: 'id',
      timers: 'id',
      backups: 'id',
    });
    await legacy.open();
    const fixture = foodFixture();
    await legacy.table('ingredients').bulkPut(fixture.ingredients);
    await legacy.table('recipes').bulkPut(fixture.recipes);
    await legacy.table('settings').put({ ...defaults, nickname: 'Synthetic person' });
    legacy.close();
    const upgraded = new TrainingDB(name);
    try {
      await upgraded.open();
      const data = await readData(upgraded);
      expect(data.food?.recipes[0].id).toBe('rice-meal');
      expect(data.food?.foodProgrammes).toEqual([]);
      expect(await upgraded.table('settings').get('preferences')).toMatchObject({
        nickname: 'Synthetic person',
      });
    } finally {
      await upgraded.delete();
    }
  });
});
