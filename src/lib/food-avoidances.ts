import { db, readData } from './db';
import { now } from './model';
import { foodDay } from './food-calc';
import { mealIngredientIds } from './food-programmes';
import { regenerateShopping } from './food-actions';
import {
  FoodScheduleSchema,
  MealPlanSchema,
  mealSlots,
  foodDate,
  validateFood,
  type FoodData,
  type MealPlan,
} from './food-model';

export type FoodAvoidanceChange = {
  plan: MealPlan;
  beforeName: string;
  replacement?: { id: string; name: string };
};
export type FoodAvoidancePreview = {
  scheduleId: string;
  programmeName: string;
  from: string;
  exclusions: string[];
  changes: FoodAvoidanceChange[];
  reviewKey: string;
};
export class FoodAvoidanceReviewChanged extends Error {
  constructor() {
    super(
      'The programme or its meals changed. Review the updated meal changes before saving again.',
    );
  }
}

/** Review only existing, unchecked programme plans; this never fills empty slots. */
export function previewFoodAvoidances(
  food: FoodData,
  scheduleId: string,
  exclusions: string[],
  from = foodDay(),
): FoodAvoidancePreview {
  foodDate.parse(from);
  const saved = food.foodSchedules.find((schedule) => schedule.id === scheduleId);
  if (!saved) throw Error('This programme schedule no longer exists.');
  if (saved.status === 'completed')
    throw Error('This programme has ended. Start a new schedule to choose foods to avoid.');
  const selected = [...new Set(exclusions)].sort();
  if (selected.some((id) => !food.ingredients.some((ingredient) => ingredient.id === id)))
    throw Error('One of the selected ingredients no longer exists. Review your food choices.');
  const schedule = FoodScheduleSchema.parse({ ...saved, exclusions: selected });
  const candidates = food.mealPlans
    .filter(
      (plan) =>
        plan.scheduleId === scheduleId &&
        plan.date >= from &&
        !saved.omitted.includes(plan.occurrenceId ?? plan.id) &&
        !food.foodEntries.some((entry) => entry.occurrenceId === (plan.occurrenceId ?? plan.id)),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        mealSlots.indexOf(a.slot) - mealSlots.indexOf(b.slot) ||
        a.id.localeCompare(b.id),
    );
  const changes = candidates.flatMap((plan): FoodAvoidanceChange[] => {
    const current = food.recipes.find((recipe) => recipe.id === plan.recipeId);
    if (!current || !mealIngredientIds(current).some((id) => selected.includes(id))) return [];
    const elapsedDays = Math.round(
      (Date.parse(plan.date + 'T12:00:00Z') - Date.parse(schedule.start + 'T12:00:00Z')) / 86400000,
    );
    const day =
      ((elapsedDays % schedule.snapshot.cycleDays) + schedule.snapshot.cycleDays) %
      schedule.snapshot.cycleDays;
    const rotation = schedule.snapshot.rotation.find(
      (row) => row.day === day && row.slot === plan.slot,
    );
    const replacement = rotation?.recipeIds
      .map((id) => food.recipes.find((recipe) => recipe.id === id))
      .find(
        (recipe) =>
          recipe &&
          !recipe.archived &&
          !recipe.draft &&
          mealIngredientIds(recipe).length > 0 &&
          !mealIngredientIds(recipe).some((id) => selected.includes(id)),
      );
    return [
      {
        plan: MealPlanSchema.parse(plan),
        beforeName: current.name,
        replacement: replacement && { id: replacement.id, name: replacement.name },
      },
    ];
  });
  const recipeIds = new Set([
    ...schedule.snapshot.rotation.flatMap((row) => row.recipeIds),
    ...candidates.map((plan) => plan.recipeId),
  ]);
  // Compare relevant current records again inside the write transaction. A newly
  // logged meal, changed swap or changed recipe requires a fresh review.
  const reviewKey = JSON.stringify({
    schedule: FoodScheduleSchema.parse(saved),
    selected,
    from,
    candidates: candidates.map((plan) => MealPlanSchema.parse(plan)),
    recipes: food.recipes
      .filter((recipe) => recipeIds.has(recipe.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        archived: recipe.archived,
        draft: recipe.draft,
        ingredientIds: mealIngredientIds(recipe).sort(),
      })),
    ingredients: food.ingredients
      .filter((ingredient) => selected.includes(ingredient.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((ingredient) => ({ id: ingredient.id, name: ingredient.name, brand: ingredient.brand })),
  });
  return {
    scheduleId,
    programmeName: schedule.snapshot.name,
    from,
    exclusions: selected,
    changes,
    reviewKey,
  };
}

/** Apply exactly a reviewed set of changes while preserving diary and manual records. */
export async function saveFoodAvoidances(review: FoodAvoidancePreview, database = db) {
  return database.transaction('rw', database.tables, async () => {
    if (review.from !== foodDay()) throw new FoodAvoidanceReviewChanged();
    const food = (await readData(database)).food!;
    const current = previewFoodAvoidances(food, review.scheduleId, review.exclusions, foodDay());
    if (current.reviewKey !== review.reviewKey) throw new FoodAvoidanceReviewChanged();
    const saved = food.foodSchedules.find((schedule) => schedule.id === review.scheduleId)!;
    if (
      !current.changes.length &&
      JSON.stringify([...saved.exclusions].sort()) === JSON.stringify(current.exclusions)
    )
      return 0;
    const removed = current.changes.filter((change) => !change.replacement);
    const schedule = FoodScheduleSchema.parse({
      ...saved,
      exclusions: current.exclusions,
      omitted: [
        ...new Set([
          ...saved.omitted,
          ...removed.flatMap(({ plan }) => [
            ...(plan.occurrenceId ? [plan.occurrenceId] : []),
            `${saved.id}:${plan.date}:${plan.slot}`,
          ]),
        ]),
      ],
      updatedAt: now(),
    });
    const replacementPlans = current.changes.flatMap(({ plan, replacement }) =>
      replacement
        ? [MealPlanSchema.parse({ ...plan, recipeId: replacement.id, batchId: undefined })]
        : [],
    );
    const changedIds = new Set(current.changes.map((change) => change.plan.id));
    validateFood({
      ...food,
      foodSchedules: food.foodSchedules.map((value) =>
        value.id === schedule.id ? schedule : value,
      ),
      mealPlans: [
        ...food.mealPlans.filter((plan) => !changedIds.has(plan.id)),
        ...replacementPlans,
      ],
    });
    await database.foodSchedules.put(schedule);
    if (replacementPlans.length) await database.mealPlans.bulkPut(replacementPlans);
    if (removed.length)
      await database.mealPlans.bulkDelete(removed.map((change) => change.plan.id));
    if (current.changes.length)
      for (const list of food.shoppingLists)
        if (list.from && list.to) await regenerateShopping(list.id, database);
    return current.changes.length;
  });
}
