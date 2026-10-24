import { z } from 'zod';

const id = z.string().min(1).max(200);
const text = z.string().max(20000);
const name = z.string().trim().min(1).max(200);
const n = z.number().finite().nonnegative().max(1e9);
const positive = n.positive();
const timestamp = z.string().datetime({ offset: true });
export const foodDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T12:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Enter a real date');
export const units = ['g', 'kg', 'ml', 'l', 'count'] as const;
export const UnitSchema = z.enum(units);
export type Unit = z.infer<typeof UnitSchema>;
export const mealSlots = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const;
export const MacroSchema = z
  .object({
    protein: n.optional(),
    carbs: n.optional(),
    fat: n.optional(),
    fibre: n.optional(),
  })
  .strict();
export type Macros = z.infer<typeof MacroSchema>;
export const macroKeys = ['protein', 'carbs', 'fat', 'fibre'] as const;
export const macroNames = {
  protein: 'Protein',
  carbs: 'Carbohydrates',
  fat: 'Fat',
  fibre: 'Fibre',
};
export const QuantitySchema = z.object({ quantity: n, unit: UnitSchema });
export const IngredientSchema = z
  .object({
    id,
    name,
    aliases: z.array(z.string().max(200)).max(100).default([]),
    category: z.string().max(100).default('Other'),
    brand: z.string().max(200).default(''),
    barcode: z.string().max(100).default(''),
    defaultUnit: UnitSchema.default('g'),
    basisUnit: z.enum(['g', 'ml']).default('g'),
    state: z.enum(['raw', 'cooked', 'as sold']).default('as sold'),
    macros: MacroSchema.default({}),
    nutritionStatus: z.enum(['unknown', 'manual', 'estimated', 'verified']).default('unknown'),
    source: text.default(''),
    sourceUpdatedAt: timestamp.optional(),
    density: positive.optional(),
    gramsPerCount: positive.optional(),
    package: QuantitySchema.optional(),
    location: z.string().max(100).default('Cupboard'),
    storage: text.default(''),
    notes: text.default(''),
    staple: z.boolean().default(false),
    archived: z.boolean().default(false),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine(
    (i) => i.nutritionStatus !== 'verified' || !!i.source.trim(),
    'Verified nutrition needs a source',
  );
export const RecipeLineSchema = z.object({
  id,
  ingredientId: id,
  quantity: n,
  unit: UnitSchema,
  state: z.enum(['raw', 'cooked', 'as sold']),
  optional: z.boolean().default(false),
  notes: text.default(''),
});
export const mealRoles = ['protein', 'volume', 'fat', 'flavouring', 'other'] as const;
export const CompositionLineSchema = z
  .object({
    ingredientId: id,
    name: name.optional(),
    role: z.enum(mealRoles),
    quantity: positive.optional(),
    unit: UnitSchema.optional(),
    state: z.enum(['raw', 'cooked', 'as sold']).default('as sold'),
    guidance: z.string().max(500).default(''),
  })
  .refine(
    (line) => (line.quantity === undefined) === (line.unit === undefined),
    'Supply both an amount and unit, or leave both blank',
  );
export type CompositionLine = z.infer<typeof CompositionLineSchema>;
export const RecipeSchema = z.object({
  id,
  name,
  description: text.default(''),
  category: z.enum(mealSlots).default('Dinner'),
  servings: positive.max(10000),
  unmeasured: z.boolean().optional(),
  composition: z.array(CompositionLineSchema).max(100).optional(),
  sourceUrl: z
    .string()
    .url()
    .max(2000)
    .refine((s) => /^https?:/.test(s), 'Use an http or https source')
    .optional(),
  ingredients: z.array(RecipeLineSchema).max(500),
  steps: z.array(z.object({ id, text, imageId: id.optional() })).max(500),
  prepMinutes: n.max(10000).default(0),
  cookMinutes: n.max(10000).default(0),
  equipment: z.array(z.string().max(100)).max(50).default([]),
  dietary: z.array(z.string().max(100)).max(50).default([]),
  difficulty: z.enum(['Easy', 'Medium', 'Involved']).default('Easy'),
  favourite: z.boolean().default(false),
  rating: n.max(5).default(0),
  notes: text.default(''),
  storage: text.default(''),
  reheating: text.default(''),
  batchNotes: text.default(''),
  imageId: id.optional(),
  draft: z.boolean().default(false),
  archived: z.boolean().default(false),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const FoodProgrammeSchema = z.object({
  id,
  name,
  description: text.default(''),
  sourceName: z.string().max(200).default(''),
  sourceUrl: z
    .string()
    .max(2000)
    .default('')
    .refine((s) => !s || /^https?:\/\//.test(s), 'Use an http or https source'),
  contentVersion: z.number().int().min(1).max(10000).default(1),
  days: z.number().int().min(1).max(366).default(30),
  cycleDays: z.number().int().min(1).max(28).default(7),
  groups: z
    .array(
      z.object({
        id,
        name,
        role: z.enum(mealRoles),
        ingredientIds: z.array(id).max(200),
        guidance: text.default(''),
      }),
    )
    .max(30)
    .default([]),
  habits: z
    .array(z.object({ id, name, notes: text.default('') }))
    .max(20)
    .default([]),
  rotation: z
    .array(
      z.object({
        day: z.number().int().min(0).max(27),
        slot: z.enum(mealSlots),
        recipeIds: z.array(id).min(1).max(100),
      }),
    )
    .max(112)
    .default([]),
  archived: z.boolean().default(false),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type FoodProgramme = z.infer<typeof FoodProgrammeSchema>;
export const FoodScheduleSchema = z.object({
  id,
  programmeId: id,
  snapshot: FoodProgrammeSchema,
  start: foodDate,
  days: z.number().int().min(1).max(366),
  slots: z.array(z.enum(mealSlots)).min(1).max(4),
  habits: z.array(id).max(20).default([]),
  exclusions: z.array(id).max(200).default([]),
  omitted: z.array(id).max(2000).default([]),
  status: z.enum(['active', 'paused', 'completed']),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type FoodSchedule = z.infer<typeof FoodScheduleSchema>;
export const NutritionSnapshotSchema = z.object({
  macros: MacroSchema,
  missing: z.array(z.string().max(200)).max(1000),
  estimated: z.boolean(),
  cost: n.optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  ingredients: z.array(RecipeLineSchema).max(500).default([]),
});
export const FoodEntrySchema = z.object({
  id,
  date: foodDate,
  slot: z.enum(mealSlots),
  name,
  recipeId: id.optional(),
  batchId: id.optional(),
  unmeasured: z.boolean().optional(),
  composition: z.array(CompositionLineSchema).max(100).optional(),
  occurrenceId: id.optional(),
  servings: positive.max(10000),
  snapshot: NutritionSnapshotSchema,
  notes: text.default(''),
  createdAt: timestamp,
});
export const MealPlanSchema = z.object({
  id,
  scheduleId: id.optional(),
  occurrenceId: id.optional(),
  date: foodDate,
  slot: z.enum(mealSlots),
  recipeId: id,
  batchId: id.optional(),
  servings: positive.max(10000),
  notes: text.default(''),
  createdAt: timestamp,
});
export const StockSchema = z.object({
  id,
  ingredientId: id,
  quantity: n,
  unit: UnitSchema,
  packageSize: n.optional(),
  purchased: foodDate.optional(),
  opened: foodDate.optional(),
  expires: foodDate.optional(),
  expiryKind: z.enum(['best-before', 'use-by']).default('best-before'),
  location: z.string().trim().min(1).max(100),
  originalQuantity: n,
  price: n.optional(),
  purchaseId: id.optional(),
  purchaseLineId: id.optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  brand: z.string().max(200).default(''),
  confidence: z.enum(['confirmed', 'estimated', 'needs checking']).default('confirmed'),
  notes: text.default(''),
  createdAt: timestamp,
});
export const MovementSchema = z.object({
  id,
  stockId: id.optional(),
  batchId: id.optional(),
  ingredientId: id.optional(),
  quantity: z.number().finite().min(-1e9).max(1e9),
  unit: z.union([UnitSchema, z.literal('portion')]),
  kind: z.enum(['added', 'adjusted', 'cooked', 'eaten', 'waste', 'moved']),
  at: timestamp,
  notes: text,
  cost: n.optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
});
export const BatchSchema = z
  .object({
    id,
    recipeId: id,
    name,
    prepared: foodDate,
    expires: foodDate.optional(),
    location: z.string().min(1).max(100),
    produced: positive,
    remaining: n,
    snapshot: NutritionSnapshotSchema,
    notes: text.default(''),
    createdAt: timestamp,
  })
  .refine((b) => b.remaining <= b.produced, 'Remaining portions exceed the prepared batch')
  .refine(
    (b) => !b.expires || b.expires >= b.prepared,
    'Expiry cannot be before the preparation date',
  );
export const PurchaseLineSchema = z.object({
  id,
  description: name,
  ingredientId: id.optional(),
  quantity: positive.optional(),
  unit: UnitSchema.default('g'),
  packages: positive.default(1),
  paid: n,
  discount: n.default(0),
  received: z.boolean().default(false),
  location: z.string().min(1).max(100).default('Cupboard'),
  expires: foodDate.optional(),
});
export const PurchaseSchema = z.object({
  id,
  retailer: name,
  date: foodDate,
  currency: z.string().regex(/^[A-Z]{3}$/),
  lines: z.array(PurchaseLineSchema).max(1000),
  total: n,
  notes: text.default(''),
  imageId: id.optional(),
  fingerprint: z.string().max(200).optional(),
  reviewed: z.literal(true),
  createdAt: timestamp,
});
export const ShoppingItemSchema = z.object({
  id,
  name,
  ingredientId: id.optional(),
  quantity: n,
  unit: UnitSchema,
  shortage: n.optional(),
  packages: n.optional(),
  estimatedCost: n.optional(),
  generated: z.boolean(),
  overridesRequirement: z.boolean().optional(),
  checked: z.boolean().default(false),
  received: z.boolean().default(false),
  notes: text.default(''),
});
export const ShoppingListSchema = z.object({
  id,
  checklist: z
    .array(z.object({ id, ingredientId: id, name, checked: z.boolean(), notes: text.default('') }))
    .max(1000)
    .optional(),
  name,
  from: foodDate.optional(),
  to: foodDate.optional(),
  recipeId: id.optional(),
  servings: positive.optional(),
  items: z.array(ShoppingItemSchema).max(2000),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const FoodSettingsSchema = z.object({
  id: z.literal('food-preferences'),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('GBP'),
  targets: z
    .object({
      protein: positive.optional(),
      carbs: positive.optional(),
      fat: positive.optional(),
      fibre: positive.optional(),
    })
    .default({}),
  showCalories: z.boolean().default(false),
  calorieTarget: positive.max(20000).optional(),
  goalSetup: z
    .object({
      goal: z.enum(['maintain', 'lose', 'gain']),
      method: z.literal('mifflin-v1'),
      generatedAt: timestamp,
    })
    .optional(),
  weeklyBudget: positive.optional(),
  monthlyBudget: positive.optional(),
  locations: z
    .array(z.string().trim().min(1).max(100))
    .min(1)
    .max(50)
    .default(['Fridge', 'Freezer', 'Cupboard']),
});
// Inline, validated raster attachments make full JSON backups self contained.
export const FoodFileSchema = z
  .object({
    id,
    name: z.string().max(200),
    mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    data: z
      .string()
      .max(8 * 1024 * 1024)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
    createdAt: timestamp,
  })
  .refine(
    (file) => file.data.startsWith('data:' + file.mime + ';base64,'),
    'Image type and attachment data disagree',
  );
export const FoodDraftSchema = z.object({
  id,
  kind: z.enum(['recipe', 'ingredient', 'purchase', 'bowl', 'food-programme']),
  json: z.string().max(20 * 1024 * 1024),
  updatedAt: timestamp,
});
// Drafts may be incomplete, but their shape must still be safe for editor controls.
const draftMacros = z.object(
  Object.fromEntries(macroKeys.map((key) => [key, z.number().finite().optional()])),
);
const recipeEditorSchema = RecipeSchema.extend({
  name: text,
  servings: z.number().finite(),
  sourceUrl: text.optional(),
  ingredients: z
    .array(RecipeLineSchema.extend({ ingredientId: text, quantity: z.number().finite() }))
    .max(500),
});
const editorSchemas = {
  bowl: recipeEditorSchema,
  'food-programme': FoodProgrammeSchema.extend({
    name: text,
    sourceUrl: text,
    days: z.number().finite(),
    cycleDays: z.number().finite(),
  }),
  ingredient: z.object({ ...IngredientSchema.shape, name: text, macros: draftMacros }),
  recipe: RecipeSchema.extend({
    name: text,
    servings: z.number().finite(),
    ingredients: z
      .array(RecipeLineSchema.extend({ ingredientId: text, quantity: z.number().finite() }))
      .max(500),
  }),
  purchase: PurchaseSchema.extend({
    retailer: text,
    date: text,
    lines: z
      .array(
        PurchaseLineSchema.extend({ description: text, quantity: z.number().finite().optional() }),
      )
      .max(1000),
  }),
};
export function readFoodDraft(kind: keyof typeof editorSchemas, json: string): unknown {
  try {
    const result = editorSchemas[kind].safeParse(JSON.parse(json));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
export const foodSchemas = {
  foodProgrammes: FoodProgrammeSchema,
  foodSchedules: FoodScheduleSchema,
  ingredients: IngredientSchema,
  recipes: RecipeSchema,
  foodEntries: FoodEntrySchema,
  mealPlans: MealPlanSchema,
  stock: StockSchema,
  movements: MovementSchema,
  batches: BatchSchema,
  purchases: PurchaseSchema,
  shoppingLists: ShoppingListSchema,
  foodFiles: FoodFileSchema,
  foodDrafts: FoodDraftSchema,
} as const;
export const foodTables = Object.keys(foodSchemas) as (keyof typeof foodSchemas)[];
export const FoodDataSchema = z.object({
  foodProgrammes: z.array(FoodProgrammeSchema).max(1000).default([]),
  foodSchedules: z.array(FoodScheduleSchema).max(10000).default([]),
  ingredients: z.array(IngredientSchema).max(50000).default([]),
  recipes: z.array(RecipeSchema).max(50000).default([]),
  foodEntries: z.array(FoodEntrySchema).max(500000).default([]),
  mealPlans: z.array(MealPlanSchema).max(100000).default([]),
  stock: z.array(StockSchema).max(100000).default([]),
  movements: z.array(MovementSchema).max(1000000).default([]),
  batches: z.array(BatchSchema).max(100000).default([]),
  purchases: z.array(PurchaseSchema).max(100000).default([]),
  shoppingLists: z.array(ShoppingListSchema).max(50000).default([]),
  foodFiles: z.array(FoodFileSchema).max(10000).default([]),
  foodDrafts: z.array(FoodDraftSchema).max(100).default([]),
  foodSettings: FoodSettingsSchema.default({
    id: 'food-preferences',
    showCalories: false,
    currency: 'GBP',
    targets: {},
    locations: ['Fridge', 'Freezer', 'Cupboard'],
  }),
});
export type Ingredient = z.infer<typeof IngredientSchema>;
export type RecipeLine = z.infer<typeof RecipeLineSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type NutritionSnapshot = z.infer<typeof NutritionSnapshotSchema>;
export type FoodEntry = z.infer<typeof FoodEntrySchema>;
export type MealPlan = z.infer<typeof MealPlanSchema>;
export type Stock = z.infer<typeof StockSchema>;
export type Movement = z.infer<typeof MovementSchema>;
export type Batch = z.infer<typeof BatchSchema>;
export type Purchase = z.infer<typeof PurchaseSchema>;
export type ShoppingItem = z.infer<typeof ShoppingItemSchema>;
export type ShoppingList = z.infer<typeof ShoppingListSchema>;
export type FoodSettings = z.infer<typeof FoodSettingsSchema>;
export type FoodFile = z.infer<typeof FoodFileSchema>;
export type FoodDraft = z.infer<typeof FoodDraftSchema>;
export type FoodData = z.infer<typeof FoodDataSchema>;
export const emptyFood: FoodData = FoodDataSchema.parse({});

/** Validate relationships in complete snapshots and the resulting graph before additive imports. */
export function validateFood(data: FoodData) {
  const identifiers = new Map(
    foodTables.map((key) => [key, new Set(data[key].map((row) => row.id))] as const),
  );
  for (const key of foodTables) {
    if (identifiers.get(key)!.size !== data[key].length)
      throw Error(`Duplicate identifiers in ${key}.`);
  }
  const has = (table: keyof typeof foodSchemas, ref: string | undefined) =>
    !ref || identifiers.get(table)!.has(ref);
  const batchRecipes = new Map(data.batches.map((batch) => [batch.id, batch.recipeId]));
  const purchaseLines = new Map(
    data.purchases.map((purchase) => [
      purchase.id,
      new Map(purchase.lines.map((line) => [line.id, line.ingredientId])),
    ]),
  );
  const check = (ok: boolean, message: string) => {
    if (!ok) throw Error(message);
  };
  const occurrenceIds = data.foodEntries.map((e) => e.occurrenceId).filter(Boolean);
  check(new Set(occurrenceIds).size === occurrenceIds.length, 'Duplicate meal check-in.');
  for (const programme of [...data.foodProgrammes, ...data.foodSchedules.map((s) => s.snapshot)]) {
    check(
      new Set(programme.rotation.map((r) => r.day + ':' + r.slot)).size ===
        programme.rotation.length,
      'Duplicate rotation slot.',
    );
    check(
      new Set(programme.groups.map((g) => g.id)).size === programme.groups.length,
      'Duplicate food group.',
    );
    check(
      new Set(programme.habits.map((g) => g.id)).size === programme.habits.length,
      'Duplicate programme habit.',
    );
    for (const row of programme.rotation) {
      check(row.day < programme.cycleDays, 'Rotation day exceeds cycle length.');
      check(new Set(row.recipeIds).size === row.recipeIds.length, 'Duplicate meal alternative.');
      check(
        row.recipeIds.every((id) => has('recipes', id)),
        'Programme references a missing meal.',
      );
    }
    check(
      programme.groups.every((g) => g.ingredientIds.every((id) => has('ingredients', id))),
      'Programme references a missing ingredient.',
    );
  }
  const activeSchedules = data.foodSchedules.filter((s) => s.status === 'active');
  const scheduleEnd = (s: FoodSchedule) => {
    const d = new Date(s.start + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + s.days - 1);
    return d.toISOString().slice(0, 10);
  };
  check(
    !activeSchedules.some((a, i) =>
      activeSchedules
        .slice(i + 1)
        .some((b) => a.start <= scheduleEnd(b) && b.start <= scheduleEnd(a)),
    ),
    'Active food programme schedules overlap.',
  );
  for (const schedule of data.foodSchedules) {
    check(new Set(schedule.slots).size === schedule.slots.length, 'Duplicate schedule meal slot.');
    check(
      schedule.habits.every((id) => schedule.snapshot.habits.some((h) => h.id === id)),
      'Unknown schedule reminder.',
    );
    check(has('foodProgrammes', schedule.programmeId), 'Schedule references a missing programme.');
    check(
      schedule.snapshot.id === schedule.programmeId,
      'Schedule snapshot belongs to another programme.',
    );
    check(
      schedule.exclusions.every((id) => has('ingredients', id)),
      'Schedule exclusion is missing.',
    );
  }
  for (const entry of [...data.foodEntries, ...data.mealPlans]) {
    if ('scheduleId' in entry)
      check(has('foodSchedules', entry.scheduleId), 'Meal schedule is missing.');
    if ('composition' in entry)
      check(
        (entry.composition ?? []).every((line) => has('ingredients', line.ingredientId)),
        'Meal composition ingredient is missing.',
      );
    if ('unmeasured' in entry && entry.unmeasured && 'snapshot' in entry)
      check(
        !entry.batchId &&
          entry.snapshot.cost === undefined &&
          Object.values(entry.snapshot.macros).every((v) => v === undefined),
        'Unmeasured intake cannot have measured nutrition or prepared portions.',
      );
  }
  for (const list of data.shoppingLists)
    check(
      (list.checklist ?? []).every((i) => has('ingredients', i.ingredientId)),
      'Shopping checklist ingredient is missing.',
    );
  for (const recipe of data.recipes) {
    check(
      (recipe.composition ?? []).every((line) => has('ingredients', line.ingredientId)),
      'Recipe composition ingredient is missing.',
    );
    check(
      !recipe.unmeasured || (!recipe.ingredients.length && !!recipe.composition?.length),
      'Unmeasured meals need a composition instead of guessed recipe quantities.',
    );
    check(
      new Set(recipe.ingredients.map((i) => i.id)).size === recipe.ingredients.length,
      'Duplicate recipe line.',
    );
    check(
      new Set(recipe.steps.map((i) => i.id)).size === recipe.steps.length,
      'Duplicate recipe step.',
    );
    for (const line of recipe.ingredients)
      check(has('ingredients', line.ingredientId), 'Recipe references a missing ingredient.');
    check(
      has('foodFiles', recipe.imageId) && recipe.steps.every((s) => has('foodFiles', s.imageId)),
      'Recipe image is missing.',
    );
  }
  for (const entry of [...data.foodEntries, ...data.mealPlans, ...data.batches]) {
    check(has('recipes', entry.recipeId), 'Meal references a missing recipe.');
    if ('batchId' in entry) {
      check(has('batches', entry.batchId), 'Meal references a missing prepared batch.');
      if (entry.batchId && entry.recipeId)
        check(
          batchRecipes.get(entry.batchId) === entry.recipeId,
          'Prepared portion belongs to another recipe.',
        );
    }
    if ('snapshot' in entry)
      for (const line of entry.snapshot.ingredients)
        check(
          has('ingredients', line.ingredientId),
          'Historical snapshot references a missing ingredient.',
        );
  }
  for (const stock of data.stock) {
    check(has('ingredients', stock.ingredientId), 'Stock references a missing ingredient.');
    check(has('purchases', stock.purchaseId), 'Stock references a missing purchase.');
    if (stock.purchaseLineId)
      check(
        !!stock.purchaseId &&
          purchaseLines.get(stock.purchaseId)?.get(stock.purchaseLineId) === stock.ingredientId,
        'Stock references a missing purchase line.',
      );
  }
  for (const movement of data.movements)
    check(
      has('stock', movement.stockId) &&
        has('batches', movement.batchId) &&
        has('ingredients', movement.ingredientId),
      'Inventory movement references a missing record.',
    );
  for (const purchase of data.purchases) {
    check(has('foodFiles', purchase.imageId), 'Receipt image is missing.');
    check(
      new Set(purchase.lines.map((l) => l.id)).size === purchase.lines.length,
      'Duplicate purchase line.',
    );
    for (const line of purchase.lines)
      check(has('ingredients', line.ingredientId), 'Purchase references a missing ingredient.');
  }
  for (const list of data.shoppingLists) {
    check(has('recipes', list.recipeId), 'Shopping list references a missing recipe.');
    check(
      new Set(list.items.map((l) => l.id)).size === list.items.length,
      'Duplicate shopping item.',
    );
    for (const item of list.items)
      check(
        has('ingredients', item.ingredientId),
        'Shopping item references a missing ingredient.',
      );
  }
}
