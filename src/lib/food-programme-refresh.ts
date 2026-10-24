import { db } from './db';
import { now } from './model';
import { fillingBowlStarter } from './food-programme-starter';
import type { FoodData, Recipe } from './food-model';

// Only the original, untouched starter cooking content is eligible. Personal
// notes, photos, ratings and favourites are deliberately not part of this key.
const cookingContent = (recipe: Recipe) =>
  JSON.stringify([
    recipe.name,
    recipe.category,
    recipe.servings,
    recipe.unmeasured,
    recipe.sourceUrl,
    recipe.ingredients,
    recipe.composition,
    recipe.description,
    recipe.steps,
    recipe.prepMinutes,
    recipe.cookMinutes,
    recipe.equipment,
    recipe.dietary,
  ]);
let libraries: ReturnType<typeof fillingBowlStarter>[] | undefined;
function starters() {
  return (libraries ??= [fillingBowlStarter(1), fillingBowlStarter(2)]);
}

export function fillingBowlRecipeUpdates(food: Pick<FoodData, 'recipes' | 'ingredients'>) {
  const [old, current] = starters();
  return food.recipes.flatMap((recipe) => {
    const previous = old.recipes.find((r) => r.id === recipe.id);
    const next = current.recipes.find((r) => r.id === recipe.id);
    if (
      !previous ||
      !next ||
      cookingContent(next) === cookingContent(previous) ||
      cookingContent(recipe) !== cookingContent(previous)
    )
      return [];
    // A renamed or missing ingredient can mean the person has repurposed it.
    // Never attach directions for the original food to a different product.
    if (
      next.composition?.some((line) => {
        const expected = current.ingredients.find((i) => i.id === line.ingredientId);
        const actual = food.ingredients.find((i) => i.id === line.ingredientId);
        return !expected || !actual || actual.name !== expected.name;
      })
    )
      return [];
    return [
      {
        ...recipe,
        description: next.description,
        composition: next.composition,
        steps: next.steps,
        prepMinutes: next.prepMinutes,
        cookMinutes: next.cookMinutes,
        equipment: next.equipment,
        notes: [recipe.notes, next.notes].filter(Boolean).join('\n\n'),
        updatedAt: now(),
      },
    ];
  });
}

/** Refresh saved stock starter recipes without installing anything or touching history. */
export async function refreshFillingBowlRecipes(database = db) {
  return database.transaction('rw', [database.recipes, database.ingredients], async () => {
    const updates = fillingBowlRecipeUpdates({
      recipes: await database.recipes.toArray(),
      ingredients: await database.ingredients.toArray(),
    });
    if (updates.length) await database.recipes.bulkPut(updates);
    return updates.length;
  });
}
