import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import { uid } from '../src/lib/model';
import { estimateFoodGoals, applyFoodGoals, setCalorieVisibility } from '../src/lib/food-goals';
import { emptyFood, FoodSettingsSchema } from '../src/lib/food-model';
import { macroEnergy, recordedEnergy } from '../src/lib/food-calc';
import { foodFixture } from './food-fixture';
import { parseBackup, serialise, importBackup } from '../src/lib/backup';
let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('food-goals-' + uid());
  await database.open();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});
const input = {
  goal: 'maintain',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  equation: 'male',
  activity: 'light',
} as const;
it('produces a reproducible editable estimate with conservative goal adjustments and gram targets', () => {
  const maintain = estimateFoodGoals(input);
  expect(maintain.calorieTarget).toBe(2448);
  expect(maintain.targets).toEqual({ protein: 128, carbs: 300, fat: 82, fibre: 30 });
  expect(Math.abs(macroEnergy(maintain.targets)! - maintain.calorieTarget)).toBeLessThan(9);
  expect(estimateFoodGoals({ ...input, goal: 'lose' }).calorieTarget).toBe(2203);
  expect(estimateFoodGoals({ ...input, goal: 'gain' }).calorieTarget).toBe(2692);
  expect(estimateFoodGoals({ ...input, equation: 'female' }).calorieTarget).toBe(2219);
  expect(() => estimateFoodGoals({ ...input, age: 17 })).toThrow();
  expect(() => estimateFoodGoals({ ...input, weightKg: NaN })).toThrow();
  expect(() => estimateFoodGoals({ ...input, weightKg: 50, goal: 'lose' })).toThrow('unavailable');
});
it('derives background energy from immutable snapshots and retains unknown values in partial totals', () => {
  expect(macroEnergy({ protein: 10, carbs: 20, fat: 5 })).toBe(165);
  expect(macroEnergy({ protein: 10, carbs: 20 })).toBeUndefined();
  expect(macroEnergy({ protein: -1, carbs: 20, fat: 5 })).toBeUndefined();
  const food = foodFixture();
  const entry = {
    id: 'one',
    date: '2026-10-18',
    slot: 'Lunch',
    name: 'Meal',
    servings: 2,
    snapshot: {
      macros: { protein: 10, carbs: 20, fat: 5 },
      missing: [],
      estimated: false,
      ingredients: [],
    },
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const before = structuredClone(entry);
  expect(
    recordedEnergy([entry, { ...entry, id: 'two', snapshot: { ...entry.snapshot, macros: {} } }]),
  ).toEqual({ total: 330, missing: 1, entries: 2 });
  expect(entry).toEqual(before);
  expect(recordedEnergy(food.foodEntries).missing).toBe(0);
  expect(FoodSettingsSchema.parse({ id: 'food-preferences' }).showCalories).toBe(false);
});
it('saves only after acceptance, preserves other food preferences, and hiding calories retains targets and history', async () => {
  await database.foodSettings.put({ ...emptyFood.foodSettings, currency: 'EUR', weeklyBudget: 50 });
  const before = await readData(database);
  const preview = estimateFoodGoals(input);
  expect((await readData(database)).food!.foodSettings.targets).toEqual({});
  await applyFoodGoals(preview, false, database);
  let food = (await readData(database)).food!;
  expect(food.foodSettings).toMatchObject({
    showCalories: false,
    currency: 'EUR',
    weeklyBudget: 50,
    calorieTarget: 2448,
  });
  await setCalorieVisibility(true, database);
  await setCalorieVisibility(false, database);
  food = (await readData(database)).food!;
  expect(food.foodSettings.calorieTarget).toBe(2448);
  expect(food.foodEntries).toEqual(before.food!.foodEntries);
  const backup = parseBackup(serialise(await readData(database)));
  await database.foodSettings.put({ ...emptyFood.foodSettings, showCalories: true });
  await importBackup(backup, 'merge', database);
  expect((await readData(database)).food!.foodSettings.showCalories).toBe(true);
  await importBackup(backup, 'merge', database, { restorePreferences: true });
  expect((await readData(database)).food!.foodSettings).toEqual(food.foodSettings);
  vi.spyOn(database.foodSettings, 'put').mockRejectedValueOnce(new Error('Storage full'));
  await expect(applyFoodGoals(preview, true, database)).rejects.toThrow('Storage full');
  expect((await readData(database)).food!.foodSettings.showCalories).toBe(false);
});
