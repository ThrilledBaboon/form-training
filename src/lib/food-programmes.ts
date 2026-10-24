import { db, readData, type TrainingDB } from './db';
import { now, uid } from './model';
import { foodDay, shiftDay, recipeNutrition } from './food-calc';
import {
  FoodProgrammeSchema,
  FoodScheduleSchema,
  RecipeSchema,
  FoodEntrySchema,
  validateFood,
  type FoodData,
  type FoodProgramme,
  type FoodSchedule,
  type MealPlan,
  type Recipe,
  type FoodEntry,
} from './food-model';
import { saveFoodEntry, regenerateShopping } from './food-actions';

export function scheduleEnd(schedule: Pick<FoodSchedule, 'start' | 'days'>) {
  return shiftDay(schedule.start, schedule.days - 1);
}
export function activeFoodSchedule(food: FoodData, date = foodDay()) {
  return food.foodSchedules.find(
    (s) => s.status === 'active' && s.start <= date && scheduleEnd(s) >= date,
  );
}
export function programmeMeals(food: FoodData, schedule: FoodSchedule): MealPlan[] {
  if (schedule.status !== 'active') return [];
  const rows: MealPlan[] = [];
  for (let day = 0; day < schedule.days; day++) {
    const date = shiftDay(schedule.start, day);
    for (const slot of schedule.slots) {
      const choices = schedule.snapshot.rotation.find(
        (r) => r.day === day % schedule.snapshot.cycleDays && r.slot === slot,
      );
      const occurrenceId = `${schedule.id}:${date}:${slot}`;
      if (schedule.omitted?.includes(occurrenceId)) continue;
      const recipe = choices?.recipeIds
        .map((id) => food.recipes.find((r) => r.id === id))
        .find(
          (r) =>
            r &&
            !r.archived &&
            !r.draft &&
            !mealIngredientIds(r).some((id) => schedule.exclusions.includes(id)),
        );
      if (recipe)
        rows.push({
          id: occurrenceId,
          occurrenceId,
          scheduleId: schedule.id,
          date,
          slot,
          recipeId: recipe.id,
          servings: 1,
          notes: '',
          createdAt: schedule.createdAt,
        });
    }
  }
  return rows;
}
export function mealIngredientIds(recipe: Recipe) {
  return [
    ...new Set([
      ...recipe.ingredients.map((i) => i.ingredientId),
      ...(recipe.composition ?? []).map((i) => i.ingredientId),
    ]),
  ];
}
export function programmePreview(food: FoodData, schedule: FoodSchedule) {
  return programmeMeals(food, schedule).map((plan) => ({
    plan,
    existing: food.mealPlans.find((p) => p.occurrenceId === plan.occurrenceId),
    conflict: food.mealPlans.some(
      (p) => p.date === plan.date && p.slot === plan.slot && p.occurrenceId !== plan.occurrenceId,
    ),
  }));
}
export async function saveFoodProgramme(value: FoodProgramme, database = db) {
  const programme = FoodProgrammeSchema.parse({ ...value, updatedAt: now() });
  await database.transaction('rw', database.tables, async () => {
    const food = (await readData(database)).food!;
    validateFood({
      ...food,
      foodProgrammes: [...food.foodProgrammes.filter((p) => p.id !== programme.id), programme],
    });
    await database.foodProgrammes.put(programme);
    await database.foodDrafts.delete('food-programme-editor');
  });
}
export async function saveComposition(value: Recipe, database = db) {
  const recipe = RecipeSchema.parse({ ...value, updatedAt: now() });
  await database.transaction('rw', database.tables, async () => {
    const food = (await readData(database)).food!;
    validateFood({ ...food, recipes: [...food.recipes.filter((r) => r.id !== recipe.id), recipe] });
    await database.recipes.put(recipe);
    await database.foodDrafts.delete('bowl-editor');
  });
}
export async function startFoodSchedule(value: FoodSchedule, database = db) {
  const schedule = FoodScheduleSchema.parse(value);
  await database.transaction('rw', database.tables, async () => {
    const food = (await readData(database)).food!;
    const old = food.foodSchedules.find((s) => s.id === schedule.id);
    if (old) throw Error('This programme has already been started. Open its saved schedule.');
    assertNoOverlap(food, schedule);
    validateFood({ ...food, foodSchedules: [...food.foodSchedules, schedule] });
    await database.foodSchedules.add(schedule);
    await fillFoodSchedule(schedule.id, undefined, database);
  });
}
function assertNoOverlap(food: FoodData, schedule: FoodSchedule) {
  if (
    schedule.status === 'active' &&
    food.foodSchedules.some(
      (s) =>
        s.id !== schedule.id &&
        s.status === 'active' &&
        s.start <= scheduleEnd(schedule) &&
        schedule.start <= scheduleEnd(s),
    )
  )
    throw Error(
      'Another programme overlaps these dates. Pause or end it, or choose another start date.',
    );
}
export async function changeFoodSchedule(
  id: string,
  patch: Pick<Partial<FoodSchedule>, 'status' | 'days'>,
  database = db,
) {
  await database.transaction('rw', database.tables, async () => {
    const food = (await readData(database)).food!;
    const old = food.foodSchedules.find((s) => s.id === id);
    if (!old) throw Error('Programme schedule no longer exists.');
    const schedule = FoodScheduleSchema.parse({ ...old, ...patch, updatedAt: now() });
    assertNoOverlap(food, schedule);
    await database.foodSchedules.put(schedule);
  });
}
/** Only fills free slots and never rewrites swaps, moved occurrences or unrelated plans. */
export async function fillFoodSchedule(id: string, from?: string, database = db) {
  return database.transaction('rw', database.tables, async () => {
    const food = (await readData(database)).food!;
    const schedule = food.foodSchedules.find((s) => s.id === id);
    if (!schedule || schedule.status !== 'active') throw Error('Choose an active programme.');
    let added = 0;
    for (const row of programmePreview(food, schedule)) {
      if (
        (from && (row.plan.date < from || row.plan.date > shiftDay(from, 6))) ||
        row.existing ||
        row.conflict
      )
        continue;
      await database.mealPlans.add(row.plan);
      added++;
    }
    for (const list of food.shoppingLists)
      if (list.from && list.to) await regenerateShopping(list.id, database);
    return added;
  });
}
export async function removeFutureProgrammePlans(id: string, database = db) {
  await database.transaction('rw', database.tables, async () => {
    const schedule = await database.foodSchedules.get(id);
    if (!schedule) throw Error('Programme schedule missing.');
    const entries = await database.foodEntries.toArray();
    const plans = (await database.mealPlans.toArray()).filter(
      (p) =>
        p.scheduleId === id &&
        p.date >= foodDay() &&
        !entries.some((e) => e.occurrenceId === p.occurrenceId),
    );
    await database.foodSchedules.put({
      ...schedule,
      omitted: [
        ...new Set([
          ...(schedule.omitted ?? []),
          ...plans.flatMap((p) => (p.occurrenceId ? [p.occurrenceId] : [])),
        ]),
      ],
      updatedAt: now(),
    });
    await database.mealPlans.bulkDelete(plans.map((p) => p.id));
    for (const list of await database.shoppingLists.toArray())
      if (list.from && list.to) await regenerateShopping(list.id, database);
  });
}
export function quickMealEntry(
  food: FoodData,
  recipe: Recipe,
  options: {
    id?: string;
    date: string;
    slot: FoodEntry['slot'];
    notes?: string;
    occurrenceId?: string;
    measured?: boolean;
    servings?: number;
  },
): FoodEntry {
  const measured = !!options.measured && !recipe.unmeasured;
  if (options.measured && recipe.unmeasured)
    throw Error('Add quantities to this meal first, or choose a quantified recipe.');
  return FoodEntrySchema.parse({
    id: options.id ?? uid(),
    date: options.date,
    slot: options.slot,
    name: recipe.name,
    recipeId: recipe.id,
    occurrenceId: options.occurrenceId,
    unmeasured: !measured,
    // One record multiplier, never presented as a measured serving for an unmeasured meal.
    servings: measured ? (options.servings ?? 1) : 1,
    composition: recipe.composition?.map((line) => ({
      ...line,
      name: food.ingredients.find((i) => i.id === line.ingredientId)?.name ?? line.name,
    })),
    snapshot: measured
      ? recipeNutrition(food, recipe, 1)
      : {
          macros: {},
          missing: ['Unmeasured meal — nutrition and portions unknown'],
          estimated: false,
          ingredients: [],
        },
    notes: options.notes ?? '',
    createdAt: now(),
  });
}
export async function checkInMeal(
  plan: MealPlan,
  options: {
    date?: string;
    slot?: FoodEntry['slot'];
    notes?: string;
    measured?: boolean;
    servings?: number;
    recipeId?: string;
    entryId?: string;
  } = {},
  database: TrainingDB = db,
) {
  return database.transaction('rw', database.tables, async () => {
    const food = (await readData(database)).food!;
    const occurrenceId = plan.occurrenceId ?? plan.id;
    const existing = food.foodEntries.find((e) => e.occurrenceId === occurrenceId);
    if (existing && options.entryId !== existing.id) return existing.id;
    const recipe = food.recipes.find((r) => r.id === (options.recipeId ?? plan.recipeId));
    if (!recipe) throw Error('Meal no longer exists.');
    const date = options.date ?? plan.date;
    if (date > foodDay()) throw Error('Choose today or a past date to record food eaten.');
    const entry = quickMealEntry(food, recipe, {
      ...options,
      id: existing?.id,
      date,
      slot: options.slot ?? plan.slot,
      occurrenceId,
    });
    const preserve =
      existing &&
      existing.recipeId === entry.recipeId &&
      !!existing.unmeasured === !!entry.unmeasured;
    await saveFoodEntry(
      {
        ...entry,
        ...(preserve
          ? { snapshot: existing.snapshot, composition: existing.composition, name: existing.name }
          : {}),
        createdAt: existing?.createdAt ?? entry.createdAt,
      },
      database,
    );
    return entry.id;
  });
}
