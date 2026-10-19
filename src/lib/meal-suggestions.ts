import { type FoodData, type Recipe, macroKeys } from './food-model';
import {
  dailyMacros,
  foodDay,
  recipeNutrition,
  requirements,
  usableStock,
  shiftDay,
  convertQuantity,
} from './food-calc';
export type MealPriority = 'balanced' | 'macros' | 'stock' | 'quick' | 'cost';
export type MealOptions = {
  priority?: MealPriority;
  category?: Recipe['category'];
  maxMinutes?: number;
  maxCost?: number;
  date?: string;
};
/** A local, explainable sort of the user's own recipes. No nutritional values or prices are invented. */
export function suggestMeals(food: FoodData, options: MealOptions = {}) {
  const date = options.date ?? foodDay(),
    logged = dailyMacros(food, date);
  const priority = options.priority ?? 'balanced';
  const needed = macroKeys.filter(
    (k) =>
      food.foodSettings.targets[k] !== undefined &&
      logged[k] !== undefined &&
      food.foodSettings.targets[k]! > logged[k]!,
  );
  return food.recipes
    .filter(
      (r) =>
        !r.archived &&
        !r.draft &&
        r.ingredients.length > 0 &&
        (!options.category || r.category === options.category),
    )
    .map((recipe) => {
      const nutrition = recipeNutrition(food, recipe, 1),
        shortages = requirements(food, [{ recipeId: recipe.id, servings: 1, date }], date);
      // Zero is the legacy default for unrecorded prep/cook times.
      const minutes = recipe.prepMinutes + recipe.cookMinutes || undefined;
      const available = shortages.length === 0;
      const expiring = [
        ...new Set(
          recipe.ingredients.flatMap((line) => {
            const ingredient = food.ingredients.find((i) => i.id === line.ingredientId);
            return food.stock.some(
              (s) =>
                s.ingredientId === line.ingredientId &&
                ingredient?.state === line.state &&
                usableStock(s, date) &&
                s.expires &&
                s.expires <= shiftDay(date, 3) &&
                (convertQuantity(s.quantity, s.unit, line.unit, ingredient) ?? 0) > 0,
            )
              ? [ingredient!.name]
              : [];
          }),
        ),
      ];
      const knownNeeded = needed.filter((k) => nutrition.macros[k] !== undefined);
      const fit = knownNeeded.reduce((score, k) => {
        const remaining = food.foodSettings.targets[k]! - logged[k]!,
          amount = nutrition.macros[k]!;
        return (
          score +
          Math.min(amount, remaining) / food.foodSettings.targets[k]! -
          (Math.max(0, amount - remaining) / food.foodSettings.targets[k]!) * 0.25
        );
      }, 0);
      const stockScore = (available ? 2 : 0) + Math.min(2, expiring.length * 0.5);
      const speedScore = minutes ? 1 / (1 + minutes / 15) : 0;
      const costScore = nutrition.cost !== undefined ? 1 / (1 + nutrition.cost) : 0;
      const weights =
        priority === 'macros'
          ? [8, 1, 0.2, 0.2]
          : priority === 'stock'
            ? [1, 5, 0.2, 0.2]
            : priority === 'quick'
              ? [0.2, 0.2, 10, 0.2]
              : priority === 'cost'
                ? [0.2, 0.2, 0.2, 10]
                : [3, 1, 1, 1];
      const score =
        fit * weights[0] +
        stockScore * weights[1] +
        speedScore * weights[2] +
        costScore * weights[3] +
        (recipe.favourite ? 0.1 : 0);
      const reasons = [
        available
          ? 'Recorded kitchen stock covers one serving'
          : `${shortages.length} ingredient shortage${shortages.length === 1 ? '' : 's'} for one serving`,
        ...(expiring.length
          ? ['Uses ingredients with recorded expiry in the next 3 days: ' + expiring.join(', ')]
          : []),
        ...(knownNeeded.length
          ? [
              'Contributes to remaining ' +
                knownNeeded.map((k) => (k === 'carbs' ? 'carbs' : k)).join(', ') +
                ' goals based on logged food',
            ]
          : ['Macro fit unavailable: no remaining comparable goals']),
      ];
      return { recipe, nutrition, shortages, minutes, available, expiring, score, reasons };
    })
    .filter(
      (s) =>
        (options.maxMinutes === undefined ||
          (s.minutes !== undefined && s.minutes <= options.maxMinutes)) &&
        (options.maxCost === undefined ||
          (s.nutrition.cost !== undefined && s.nutrition.cost <= options.maxCost)),
    )
    .sort((a, b) => {
      // Missing costs and times must never win as if they were free or instant.
      if (priority === 'quick' && (a.minutes === undefined) !== (b.minutes === undefined))
        return a.minutes === undefined ? 1 : -1;
      if (
        priority === 'cost' &&
        (a.nutrition.cost === undefined) !== (b.nutrition.cost === undefined)
      )
        return a.nutrition.cost === undefined ? 1 : -1;
      if (
        priority === 'quick' &&
        a.minutes !== undefined &&
        b.minutes !== undefined &&
        a.minutes !== b.minutes
      )
        return a.minutes - b.minutes;
      if (
        priority === 'cost' &&
        a.nutrition.cost !== undefined &&
        b.nutrition.cost !== undefined &&
        a.nutrition.cost !== b.nutrition.cost
      )
        return a.nutrition.cost - b.nutrition.cost;
      return (
        b.score - a.score ||
        a.recipe.name.localeCompare(b.recipe.name) ||
        a.recipe.id.localeCompare(b.recipe.id)
      );
    });
}
