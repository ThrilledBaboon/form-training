import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import { now, uid } from '../src/lib/model';
import { FoodScheduleSchema } from '../src/lib/food-model';
import { fillingBowlStarter } from '../src/lib/food-programme-starter';
import { importFoodProgrammeLibrary } from '../src/lib/food-programme-library';
import { startFoodSchedule, checkInMeal } from '../src/lib/food-programmes';
import { foodDay } from '../src/lib/food-calc';
import { refreshFillingBowlRecipes } from '../src/lib/food-programme-refresh';

let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('recipe-refresh-' + uid());
  await database.open();
});
afterEach(async () => {
  await database.delete();
});
const food = async () => (await readData(database)).food!;
async function legacy() {
  const library = fillingBowlStarter(1);
  await importFoodProgrammeLibrary(library, false, database);
  return library;
}

describe('starter recipe cooking guide refresh', () => {
  it('refreshes installed recipes once, preserving personal metadata and all recorded meals and plans', async () => {
    const library = await legacy();
    const recipe = library.recipes[0];
    await database.recipes.update(recipe.id, {
      favourite: true,
      rating: 4,
      notes: 'My own serving idea',
      archived: true,
    });
    await startFoodSchedule(
      FoodScheduleSchema.parse({
        id: 'schedule',
        programmeId: library.programmes[0].id,
        snapshot: library.programmes[0],
        start: foodDay(),
        days: 2,
        slots: ['Lunch', 'Dinner'],
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
      }),
      database,
    );
    await checkInMeal((await food()).mealPlans[0], { notes: 'Already eaten' }, database);
    const before = await food();
    expect(await refreshFillingBowlRecipes(database)).toBe(18);
    const after = await food();
    expect(after.recipes.find((r) => r.id === recipe.id)).toMatchObject({
      favourite: true,
      rating: 4,
      archived: true,
      unmeasured: true,
      ingredients: [],
    });
    expect(after.recipes.find((r) => r.id === recipe.id)?.notes).toContain('My own serving idea');
    for (const key of Object.keys(before) as (keyof typeof before)[])
      if (key !== 'recipes') expect(after[key]).toEqual(before[key]);
    expect(await refreshFillingBowlRecipes(database)).toBe(0);
    expect((await food()).recipes).toEqual(after.recipes);
  });

  it('keeps edited recipe text, ingredients, timings, names and copies untouched', async () => {
    const { recipes } = await legacy();
    await database.recipes.update(recipes[0].id, { description: 'My version' });
    await database.recipes.update(recipes[1].id, { steps: [{ id: 'custom', text: 'My method' }] });
    await database.recipes.update(recipes[2].id, {
      composition: recipes[2].composition?.slice(0, 1),
    });
    await database.recipes.update(recipes[3].id, { prepMinutes: 8 });
    await database.recipes.update(recipes[4].id, { name: 'My lunch' });
    await database.recipes.put({ ...recipes[5], id: 'my-copy', name: 'My copied bowl' });
    const before = await food();
    expect(await refreshFillingBowlRecipes(database)).toBe(13);
    const after = await food();
    for (const id of [...recipes.slice(0, 5).map((r) => r.id), 'my-copy'])
      expect(after.recipes.find((r) => r.id === id)).toEqual(
        before.recipes.find((r) => r.id === id),
      );
  });

  it('does not attach directions to renamed or missing ingredients', async () => {
    const library = await legacy();
    const chicken = library.ingredients.find((i) => i.name === 'Chicken breast')!;
    await database.ingredients.update(chicken.id, { name: 'Different food' });
    const before = await food();
    const affected = before.recipes.filter((r) =>
      r.composition?.some((l) => l.ingredientId === chicken.id),
    );
    await refreshFillingBowlRecipes(database);
    const after = await food();
    for (const recipe of affected)
      expect(after.recipes.find((r) => r.id === recipe.id)).toEqual(recipe);
  });

  it('adds nothing to empty profiles and leaves current guides unchanged', async () => {
    const empty = await food();
    expect(await refreshFillingBowlRecipes(database)).toBe(0);
    expect(await food()).toEqual(empty);
    await importFoodProgrammeLibrary(fillingBowlStarter(), false, database);
    const current = await food();
    expect(await refreshFillingBowlRecipes(database)).toBe(0);
    expect(await food()).toEqual(current);
  });
});
