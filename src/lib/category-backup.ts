import { type Data, emptyData } from './model';
import {
  emptyFood,
  foodTables,
  type FoodData,
  type Recipe,
  type FoodEntry,
  type MealPlan,
  type Batch,
  type Stock,
  type Movement,
  type Purchase,
  type ShoppingList,
} from './food-model';
import { serialise, parseBackup, csv } from './backup';
export const dataCategories = {
  workspace: 'Pages, systems, equipment & import drafts',
  workouts: 'Workouts & exercise history',
  exercises: 'Exercise library',
  routines: 'Routines & programmes',
  plans: 'Training plans',
  bodyweights: 'Bodyweight',
  preferences: 'Training preferences & timer',
  ingredients: 'Ingredients',
  recipes: 'Recipes',
  diary: 'Food diary',
  mealPlans: 'Meal plans',
  inventory: 'Kitchen, batches & movements',
  shopping: 'Shopping lists',
  purchases: 'Purchases & prices',
  foodPreferences: 'Food targets, budgets & locations',
  files: 'All uploaded images',
  drafts: 'Food editor drafts',
} as const;
export type DataCategory = keyof typeof dataCategories;
export const gymCategories: DataCategory[] = [
  'workspace',
  'workouts',
  'exercises',
  'routines',
  'plans',
  'bodyweights',
  'preferences',
];
export const foodCategories: DataCategory[] = [
  'ingredients',
  'recipes',
  'diary',
  'mealPlans',
  'inventory',
  'shopping',
  'purchases',
  'foodPreferences',
  'files',
  'drafts',
];
/** Dependency closure keeps category files independently valid without including unrelated history. */
export function categoryExport(data: Data, selected: DataCategory[]) {
  if (!selected.length) throw Error('Choose at least one category.');
  const result = structuredClone(emptyData);
  result.food = structuredClone(emptyFood);
  const source = data.food ?? emptyFood,
    target = result.food;
  const rows = new Map(
    foodTables.map(
      (key) =>
        [key, new Map<string, { id: string }>(source[key].map((row) => [row.id, row]))] as const,
    ),
  );
  const included = new Map(foodTables.map((key) => [key, new Set<string>()] as const));
  const addFood = (key: (typeof foodTables)[number], id: string | undefined): void => {
    if (!id || included.get(key)!.has(id)) return;
    const row = rows.get(key)!.get(id);
    if (!row) throw Error(`Cannot export a missing ${key} dependency.`);
    included.get(key)!.add(id);
    (target[key] as { id: string }[]).push(structuredClone(row));
    if (key === 'recipes') {
      const r = row as Recipe;
      for (const line of r.ingredients) addFood('ingredients', line.ingredientId);
      addFood('foodFiles', r.imageId);
      for (const step of r.steps) addFood('foodFiles', step.imageId);
    }
    if (key === 'foodEntries' || key === 'mealPlans' || key === 'batches') {
      const r = row as FoodEntry | MealPlan | Batch;
      addFood('recipes', r.recipeId);
      if ('batchId' in r) addFood('batches', r.batchId);
      if ('snapshot' in r)
        for (const line of r.snapshot.ingredients) addFood('ingredients', line.ingredientId);
    }
    if (key === 'stock') {
      const s = row as Stock;
      addFood('ingredients', s.ingredientId);
      addFood('purchases', s.purchaseId);
    }
    if (key === 'movements') {
      const m = row as Movement;
      addFood('stock', m.stockId);
      addFood('batches', m.batchId);
      addFood('ingredients', m.ingredientId);
    }
    if (key === 'purchases') {
      const p = row as Purchase;
      addFood('foodFiles', p.imageId);
      for (const line of p.lines) addFood('ingredients', line.ingredientId);
    }
    if (key === 'shoppingLists') {
      const s = row as ShoppingList;
      addFood('recipes', s.recipeId);
      for (const line of s.items) addFood('ingredients', line.ingredientId);
    }
  };
  const copyFood = (key: (typeof foodTables)[number]) =>
    source[key].forEach((r) => addFood(key, r.id));
  for (const category of selected)
    switch (category) {
      case 'workspace':
        result.workspace = structuredClone(data.workspace);
        break;
      case 'workouts':
        result.sessions = structuredClone(data.sessions);
        result.sets = structuredClone(data.sets);
        break;
      case 'exercises':
        result.exercises = structuredClone(data.exercises);
        result.mappings = structuredClone(data.mappings);
        break;
      case 'routines':
        result.routines = structuredClone(data.routines);
        result.programmes = structuredClone(data.programmes);
        break;
      case 'plans':
        result.plans = structuredClone(data.plans);
        break;
      case 'bodyweights':
        result.bodyweights = structuredClone(data.bodyweights);
        break;
      case 'preferences':
        result.settings = structuredClone(data.settings);
        result.timer = structuredClone(data.timer);
        break;
      case 'ingredients':
        copyFood('ingredients');
        break;
      case 'recipes':
        copyFood('recipes');
        break;
      case 'diary':
        copyFood('foodEntries');
        break;
      case 'mealPlans':
        copyFood('mealPlans');
        break;
      case 'inventory':
        copyFood('stock');
        copyFood('batches');
        copyFood('movements');
        break;
      case 'shopping':
        copyFood('shoppingLists');
        break;
      case 'purchases':
        copyFood('purchases');
        break;
      case 'foodPreferences':
        target.foodSettings = structuredClone(source.foodSettings);
        break;
      case 'files':
        copyFood('foodFiles');
        break;
      case 'drafts':
        copyFood('foodDrafts');
        copyFood('ingredients');
        copyFood('recipes');
        copyFood('foodFiles');
        break;
    }
  for (const session of result.sessions) {
    const plan = data.plans.find((p) => p.id === session.planId);
    if (plan && !result.plans.some((p) => p.id === plan.id))
      result.plans.push(structuredClone(plan));
  }
  for (const parent of [...result.sessions, ...result.plans]) {
    const routine = data.routines.find((r) => r.id === parent.routineId);
    if (routine && !result.routines.some((r) => r.id === routine.id))
      result.routines.push(structuredClone(routine));
  }
  for (const routine of result.routines) {
    const programme = data.programmes.find((p) => p.id === routine.programmeId);
    if (programme && !result.programmes.some((p) => p.id === programme.id))
      result.programmes.push(structuredClone(programme));
  }
  const exerciseIds = new Set(
    [...result.routines, ...result.plans, ...result.sessions].flatMap((p) =>
      p.items.map((i) => i.exerciseId),
    ),
  );
  for (const setup of result.workspace?.setups ?? []) exerciseIds.add(setup.exerciseId);
  for (const id of exerciseIds) {
    if (!result.exercises.some((e) => e.id === id)) {
      const e = data.exercises.find((e) => e.id === id);
      if (e) result.exercises.push(structuredClone(e));
    }
    for (const m of data.mappings.filter((m) => m.exerciseId === id))
      if (!result.mappings.some((x) => x.id === m.id)) result.mappings.push(structuredClone(m));
  }
  const file = JSON.parse(serialise(result));
  if (!selected.includes('workspace')) delete file.data.workspace;
  file.scope = 'categories';
  file.manifest.format = 'FORM category export';
  file.manifest.requested = selected;
  file.manifest.categories = [
    ...Object.entries(result)
      .filter(([key, value]) => key !== 'food' && Array.isArray(value) && value.length)
      .map(([key]) => key),
    ...foodTables.filter((key) => target[key].length),
    ...(selected.includes('workspace') ? ['workspace'] : []),
    ...(selected.includes('preferences') ? ['settings', 'timer'] : []),
    ...(selected.includes('foodPreferences') ? ['foodSettings'] : []),
  ];
  return JSON.stringify(parseBackup(JSON.stringify(file)), null, 2);
}
export const foodCsvKinds = [
  'ingredients',
  'diary',
  'inventory',
  'purchases',
  'mealPlans',
  'shopping',
] as const;
export type FoodCsvKind = (typeof foodCsvKinds)[number];
export function foodCsv(food: FoodData, kind: FoodCsvKind): string {
  switch (kind) {
    case 'ingredients':
      return csv([
        [
          'id',
          'name',
          'brand',
          'state',
          'basis',
          'protein_g',
          'carbohydrates_g',
          'fat_g',
          'fibre_g',
          'nutrition_status',
          'source',
          'notes',
        ],
        ...food.ingredients.map((i) => [
          i.id,
          i.name,
          i.brand,
          i.state,
          '100 ' + i.basisUnit,
          i.macros.protein,
          i.macros.carbs,
          i.macros.fat,
          i.macros.fibre,
          i.nutritionStatus,
          i.source,
          i.notes,
        ]),
      ]);
    case 'diary':
      return csv([
        [
          'id',
          'date',
          'meal',
          'name',
          'servings',
          'protein_g',
          'carbohydrates_g',
          'fat_g',
          'fibre_g',
          'recipe_id',
          'batch_id',
          'notes',
        ],
        ...food.foodEntries.map((e) => [
          e.id,
          e.date,
          e.slot,
          e.name,
          e.servings,
          ...(['protein', 'carbs', 'fat', 'fibre'] as const).map((k) =>
            e.snapshot.macros[k] === undefined ? undefined : e.snapshot.macros[k]! * e.servings,
          ),
          e.recipeId,
          e.batchId,
          e.notes,
        ]),
      ]);
    case 'inventory':
      return csv([
        [
          'id',
          'ingredient_id',
          'quantity',
          'unit',
          'location',
          'opened',
          'expires',
          'expiry_type',
          'confidence',
          'price_paid',
          'currency',
          'purchase_id',
          'notes',
        ],
        ...food.stock.map((s) => [
          s.id,
          s.ingredientId,
          s.quantity,
          s.unit,
          s.location,
          s.opened,
          s.expires,
          s.expiryKind,
          s.confidence,
          s.price,
          s.currency ?? 'GBP',
          s.purchaseId,
          s.notes,
        ]),
      ]);
    case 'purchases':
      return csv([
        [
          'purchase_id',
          'date',
          'retailer',
          'currency',
          'checkout_total_once_per_purchase',
          'line_id',
          'description',
          'ingredient_id',
          'package_quantity',
          'unit',
          'packages',
          'net_line_paid',
          'discount_included',
          'received',
        ],
        ...food.purchases.flatMap((p) =>
          p.lines.length
            ? p.lines.map((l, index) => [
                p.id,
                p.date,
                p.retailer,
                p.currency,
                index === 0 ? p.total : undefined,
                l.id,
                l.description,
                l.ingredientId,
                l.quantity,
                l.unit,
                l.packages,
                l.paid,
                l.discount,
                l.received,
              ])
            : [[p.id, p.date, p.retailer, p.currency, p.total]],
        ),
      ]);
    case 'mealPlans':
      return csv([
        ['id', 'date', 'meal', 'recipe_id', 'batch_id', 'servings', 'notes'],
        ...food.mealPlans.map((p) => [
          p.id,
          p.date,
          p.slot,
          p.recipeId,
          p.batchId,
          p.servings,
          p.notes,
        ]),
      ]);
    case 'shopping':
      return csv([
        [
          'list_id',
          'list_name',
          'item_id',
          'name',
          'ingredient_id',
          'quantity',
          'unit',
          'shortage',
          'estimated_cost',
          'generated',
          'checked',
          'received',
          'notes',
        ],
        ...food.shoppingLists.flatMap((l) =>
          l.items.map((i) => [
            l.id,
            l.name,
            i.id,
            i.name,
            i.ingredientId,
            i.quantity,
            i.unit,
            i.shortage,
            i.estimatedCost,
            i.generated,
            i.checked,
            i.received,
            i.notes,
          ]),
        ),
      ]);
  }
}
