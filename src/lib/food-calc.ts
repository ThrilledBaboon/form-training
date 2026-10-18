import { uid } from './model';
import type {
  FoodData,
  Ingredient,
  Unit,
  Recipe,
  RecipeLine,
  Macros,
  NutritionSnapshot,
  ShoppingItem,
  MealPlan,
  Stock,
} from './food-model';
import { macroKeys } from './food-model';

export function foodDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDay(date: string, amount: number) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + amount);
  return foodDay(d);
}
export function weekDays(date: string) {
  const d = new Date(date + 'T12:00:00');
  const first = shiftDay(date, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDay(first, i));
}
const dimension = (u: Unit) =>
  u === 'kg' || u === 'g' ? 'mass' : u === 'l' || u === 'ml' ? 'volume' : 'count';
const factor = (u: Unit) => (u === 'kg' || u === 'l' ? 1000 : 1);
/** Undefined means the physical conversion is unknown, never assume water's density. */
export function convertQuantity(
  quantity: number,
  from: Unit,
  to: Unit,
  ingredient?: Ingredient,
): number | undefined {
  const a = dimension(from),
    b = dimension(to),
    value = quantity * factor(from);
  if (a === b) return value / factor(to);
  let grams: number | undefined;
  if (a === 'mass') grams = value;
  if (a === 'volume' && ingredient?.density) grams = value * ingredient.density;
  if (a === 'count' && ingredient?.gramsPerCount) grams = value * ingredient.gramsPerCount;
  if (grams === undefined) return undefined;
  if (b === 'mass') return grams / factor(to);
  if (b === 'volume' && ingredient?.density) return grams / ingredient.density / factor(to);
  if (b === 'count' && ingredient?.gramsPerCount) return grams / ingredient.gramsPerCount;
  return undefined;
}
export function scaleMacros(macros: Macros, scale: number): Macros {
  return Object.fromEntries(
    macroKeys.map((k) => [k, macros[k] === undefined ? undefined : macros[k]! * scale]),
  );
}
export function addMacros(parts: Macros[]): Macros {
  return Object.fromEntries(
    macroKeys.map((k) => [
      k,
      parts.every((p) => p[k] !== undefined) ? parts.reduce((sum, p) => sum + p[k]!, 0) : undefined,
    ]),
  );
}
export function lineNutrition(line: RecipeLine, ingredient?: Ingredient): NutritionSnapshot {
  const empty: NutritionSnapshot = {
    macros: {},
    missing: [],
    estimated: false,
    ingredients: [line],
  };
  if (line.quantity === 0) return { ...empty, macros: { protein: 0, carbs: 0, fat: 0, fibre: 0 } };
  if (!ingredient) return { ...empty, missing: ['Missing ingredient'] };
  if (line.state !== ingredient.state)
    return {
      ...empty,
      missing: [
        `${ingredient.name}: ${line.state} quantity differs from ${ingredient.state} nutrition`,
      ],
    };
  const amount = convertQuantity(line.quantity, line.unit, ingredient.basisUnit, ingredient);
  if (amount === undefined)
    return {
      ...empty,
      missing: [
        `${ingredient.name}: conversion from ${line.unit} to ${ingredient.basisUnit} is unknown`,
      ],
    };
  const missing = macroKeys
    .filter((k) => ingredient.macros[k] === undefined)
    .map((k) => `${ingredient.name}: ${k} unknown`);
  return {
    ...empty,
    macros: scaleMacros(ingredient.macros, amount / 100),
    missing,
    estimated: ingredient.nutritionStatus !== 'verified',
  };
}
export function priceFor(
  food: FoodData,
  ingredientId: string,
  quantity: number,
  unit: Unit,
): number | undefined {
  if (quantity === 0) return 0;
  const ingredient = food.ingredients.find((i) => i.id === ingredientId);
  for (const p of [...food.purchases]
    .filter((p) => p.currency === food.foodSettings.currency)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))) {
    const line = p.lines.find(
      (l) =>
        l.ingredientId === ingredientId &&
        l.quantity &&
        convertQuantity(quantity, unit, l.unit, ingredient) !== undefined,
    );
    if (line?.quantity)
      return (
        (line.paid * convertQuantity(quantity, unit, line.unit, ingredient)!) /
        (line.quantity * line.packages)
      );
  }
  return undefined;
}
export function recipeNutrition(
  food: FoodData,
  recipe: Recipe,
  servings = recipe.servings,
): NutritionSnapshot {
  if (
    !Number.isFinite(servings) ||
    servings <= 0 ||
    !Number.isFinite(recipe.servings) ||
    recipe.servings <= 0
  )
    return {
      macros: {},
      missing: ['Enter a positive serving count'],
      estimated: true,
      ingredients: [],
    };
  const scale = servings / recipe.servings;
  const ingredients = recipe.ingredients.map((i) => ({ ...i, quantity: i.quantity * scale }));
  const parts = ingredients.map((i) =>
    lineNutrition(
      i,
      food.ingredients.find((x) => x.id === i.ingredientId),
    ),
  );
  const costs = ingredients.map((i) =>
    i.quantity === 0
      ? 0
      : food.ingredients.find((ingredient) => ingredient.id === i.ingredientId)?.state === i.state
        ? priceFor(food, i.ingredientId, i.quantity, i.unit)
        : undefined,
  );
  return {
    macros: recipe.ingredients.length ? addMacros(parts.map((p) => p.macros)) : {},
    missing: parts.length
      ? [...new Set(parts.flatMap((p) => p.missing))]
      : ['No ingredients recorded'],
    estimated: parts.some((p) => p.estimated),
    cost:
      costs.length && costs.every((c) => c !== undefined)
        ? costs.reduce<number>((sum, c) => sum + c!, 0)
        : undefined,
    ingredients,
    currency: food.foodSettings.currency,
  };
}
export function dailyMacros(food: FoodData, date: string, slot?: string): Macros {
  return addMacros(
    food.foodEntries
      .filter((e) => e.date === date && (!slot || e.slot === slot))
      .map((e) => scaleMacros(e.snapshot.macros, e.servings)),
  );
}
export function usableStock(stock: Stock, date = foodDay()) {
  return (
    stock.quantity > 0 &&
    stock.confidence !== 'needs checking' &&
    (!stock.expires || stock.expires >= date)
  );
}
export function stockQuantity(
  food: FoodData,
  ingredientId: string,
  unit: Unit,
  date = foodDay(),
): number {
  const ingredient = food.ingredients.find((i) => i.id === ingredientId);
  return food.stock
    .filter((s) => s.ingredientId === ingredientId && usableStock(s, date))
    .reduce((sum, s) => sum + (convertQuantity(s.quantity, s.unit, unit, ingredient) ?? 0), 0);
}
export function requirements(
  food: FoodData,
  selections: { recipeId: string; servings: number; batchId?: string; date?: string }[],
  date = foodDay(),
): ShoppingItem[] {
  const needed = new Map<
    string,
    {
      ingredientId: string;
      quantity: number;
      unit: Unit;
      unknown: boolean;
      stateMismatch: boolean;
      demands: { quantity: number; date: string }[];
    }
  >();
  for (const selection of selections) {
    if (selection.batchId) continue; // Prepared portions already consumed the raw ingredients.
    const recipe = food.recipes.find((r) => r.id === selection.recipeId);
    if (!recipe) continue;
    for (const line of recipe.ingredients) {
      if (!line.quantity) continue;
      const ingredient = food.ingredients.find((i) => i.id === line.ingredientId);
      const base = ingredient?.defaultUnit ?? line.unit;
      const converted = convertQuantity(
        (line.quantity * selection.servings) / recipe.servings,
        line.unit,
        base,
        ingredient,
      );
      const unit = converted === undefined ? line.unit : base;
      const key = line.ingredientId + ':' + unit + ':' + line.state;
      const before = needed.get(key);
      needed.set(key, {
        ingredientId: line.ingredientId,
        unit,
        quantity:
          (before?.quantity ?? 0) +
          (converted ?? (line.quantity * selection.servings) / recipe.servings),
        unknown: converted === undefined || (before?.unknown ?? false),
        stateMismatch: ingredient?.state !== line.state,
        demands: [
          ...(before?.demands ?? []),
          {
            quantity: converted ?? (line.quantity * selection.servings) / recipe.servings,
            date: selection.date && selection.date > date ? selection.date : date,
          },
        ],
      });
    }
  }
  return [...needed.values()].flatMap((need) => {
    const ingredient = food.ingredients.find((i) => i.id === need.ingredientId);
    const stock = food.stock
      .filter((s) => s.ingredientId === need.ingredientId)
      .sort(
        (a, b) =>
          (a.expires ?? '9999').localeCompare(b.expires ?? '9999') || a.id.localeCompare(b.id),
      )
      .map((s) => ({
        stock: s,
        remaining: convertQuantity(s.quantity, s.unit, need.unit, ingredient) ?? 0,
      }));
    let shortage = 0;
    for (const demand of need.demands.sort((a, b) => a.date.localeCompare(b.date))) {
      let remaining = demand.quantity;
      if (!need.stateMismatch)
        for (const pack of stock) {
          if (!usableStock(pack.stock, demand.date)) continue;
          const used = Math.min(remaining, pack.remaining);
          pack.remaining -= used;
          remaining -= used;
          if (remaining < 1e-8) break;
        }
      shortage += Math.max(0, remaining);
    }
    if (shortage < 1e-8) return [];
    const packageSize =
      ingredient?.package &&
      convertQuantity(ingredient.package.quantity, ingredient.package.unit, need.unit, ingredient);
    const packages = packageSize ? Math.ceil((shortage - 1e-8) / packageSize) : undefined;
    const quantity = packageSize && packages ? packages * packageSize : shortage;
    return [
      {
        id: uid(),
        name: ingredient?.name ?? 'Missing ingredient',
        ingredientId: need.ingredientId,
        quantity,
        unit: need.unit,
        shortage,
        packages,
        estimatedCost: need.stateMismatch
          ? undefined
          : priceFor(food, need.ingredientId, quantity, need.unit),
        generated: true,
        checked: false,
        received: false,
        notes: need.stateMismatch
          ? 'Food state differs from the ingredient record. Choose an ingredient matching the recipe before buying or cooking.'
          : need.unknown
            ? 'Conversion unavailable; check units and quantities.'
            : '',
      },
    ];
  });
}
export function recipeAvailability(food: FoodData, recipe: Recipe, servings = recipe.servings) {
  return requirements(food, [{ recipeId: recipe.id, servings }]);
}
export function planRequirements(food: FoodData, from: string, to: string) {
  return requirements(
    food,
    food.mealPlans.filter((p) => p.date >= from && p.date <= to),
    from > foodDay() ? from : foodDay(),
  );
}
export function plannedNutrition(food: FoodData, plan: MealPlan): NutritionSnapshot {
  const batch = food.batches.find((b) => b.id === plan.batchId);
  if (batch)
    return {
      ...batch.snapshot,
      macros: scaleMacros(batch.snapshot.macros, plan.servings),
      cost:
        batch.snapshot.cost === undefined ||
        (batch.snapshot.currency ?? 'GBP') !== food.foodSettings.currency
          ? undefined
          : batch.snapshot.cost * plan.servings,
    };
  const recipe = food.recipes.find((r) => r.id === plan.recipeId);
  return recipe
    ? recipeNutrition(food, recipe, plan.servings)
    : { macros: {}, missing: ['Missing recipe'], estimated: true, ingredients: [] };
}
export const foodNumber = (n: number | undefined, digits = 1) =>
  n === undefined
    ? '—'
    : new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(n);
export const money = (n: number | undefined, currency = 'GBP') =>
  n === undefined
    ? 'Unknown'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n);
export function stockValue(stock: Stock, currency = stock.currency ?? 'GBP') {
  return stock.price === undefined ||
    stock.originalQuantity === 0 ||
    (stock.currency ?? 'GBP') !== currency
    ? undefined
    : (stock.price * stock.quantity) / stock.originalQuantity;
}
export function purchaseSignature(p: {
  retailer: string;
  date: string;
  total: number;
  currency: string;
  lines: { description: string; paid: number }[];
}) {
  return JSON.stringify([
    p.retailer.trim().toLocaleLowerCase(),
    p.date,
    p.total,
    p.currency,
    p.lines.map((l) => [l.description.trim().toLocaleLowerCase(), l.paid]),
  ]);
}

/** Background energy is derived from saved macro snapshots, independently of display consent. */
export function macroEnergy(macros: Macros): number | undefined {
  const { protein, carbs, fat } = macros;
  if ([protein, carbs, fat].some((n) => n === undefined || !Number.isFinite(n) || n < 0))
    return undefined;
  return protein! * 4 + carbs! * 4 + fat! * 9;
}
export function recordedEnergy(entries: FoodData['foodEntries']) {
  const values = entries.map((e) => macroEnergy(scaleMacros(e.snapshot.macros, e.servings)));
  const known = values.filter((v): v is number => v !== undefined);
  return {
    total: known.reduce((a, b) => a + b, 0),
    missing: entries.length - known.length,
    entries: entries.length,
  };
}
export function dailyEnergy(food: FoodData, date: string) {
  return recordedEnergy(food.foodEntries.filter((e) => e.date === date));
}
