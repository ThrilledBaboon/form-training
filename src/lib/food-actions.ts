import { db, readData, type TrainingDB } from './db';
import { uid, now } from './model';
import {
  IngredientSchema,
  RecipeSchema,
  FoodEntrySchema,
  MealPlanSchema,
  StockSchema,
  PurchaseSchema,
  FoodSettingsSchema,
  ShoppingListSchema,
  FoodFileSchema,
  FoodDraftSchema,
  readFoodDraft,
  BatchSchema,
  type Ingredient,
  type Recipe,
  type FoodEntry,
  type MealPlan,
  type Stock,
  type Purchase,
  type ShoppingList,
  type FoodSettings,
  type FoodFile,
  type FoodDraft,
  type Batch,
  type FoodData,
  type Unit,
} from './food-model';
import {
  convertQuantity,
  recipeNutrition,
  usableStock,
  foodDay,
  purchaseSignature,
  planRequirements,
  recipeAvailability,
} from './food-calc';

export async function saveIngredient(value: Ingredient, database = db) {
  const ingredient = IngredientSchema.parse({ ...value, updatedAt: now() });
  await database.transaction('rw', database.ingredients, async () => {
    const normal = (s: string) => s.trim().toLocaleLowerCase();
    const match = (await database.ingredients.toArray()).find(
      (i) =>
        i.id !== ingredient.id &&
        normal(i.name) === normal(ingredient.name) &&
        normal(i.brand) === normal(ingredient.brand) &&
        i.state === ingredient.state,
    );
    if (match)
      throw Error(
        `“${match.name}” with this brand and food state already exists. Reuse or edit that ingredient.`,
      );
    await database.ingredients.put(ingredient);
  });
}
export async function saveRecipe(value: Recipe, database = db) {
  const recipe = RecipeSchema.parse({ ...value, updatedAt: now() });
  await database.transaction(
    'rw',
    [database.recipes, database.ingredients, database.foodFiles, database.foodDrafts],
    async () => {
      for (const line of [...recipe.ingredients, ...(recipe.composition ?? [])])
        if (!(await database.ingredients.get(line.ingredientId)))
          throw Error('Choose an existing ingredient for every recipe line.');
      for (const image of [recipe.imageId, ...recipe.steps.map((s) => s.imageId)].filter(Boolean))
        if (!(await database.foodFiles.get(image!))) throw Error('A recipe image is missing.');
      await database.recipes.put(recipe);
      await database.foodDrafts.delete('recipe-editor');
    },
  );
}
export async function saveRecipePhoto(recipeId: string, file?: FoodFile, database = db) {
  const photo = file ? FoodFileSchema.parse(file) : undefined;
  await database.transaction(
    'rw',
    [database.recipes, database.foodFiles, database.foodDrafts],
    async () => {
      const recipe = await database.recipes.get(recipeId);
      if (!recipe) throw Error('This recipe is no longer available.');
      if (photo) await database.foodFiles.add(photo);
      const updatedAt = now();
      // Patch the latest record and matching draft without overwriting their other edits.
      await database.recipes.put({ ...recipe, imageId: photo?.id, updatedAt });
      const saved = await database.foodDrafts.get('recipe-editor');
      const draft = saved ? (readFoodDraft('recipe', saved.json) as Recipe | undefined) : undefined;
      if (saved && draft?.id === recipeId)
        await database.foodDrafts.put({
          ...saved,
          json: JSON.stringify({ ...draft, imageId: photo?.id }),
          updatedAt,
        });
    },
  );
}
export async function saveFoodSettings(value: FoodSettings, database = db) {
  await database.foodSettings.put(FoodSettingsSchema.parse(value));
}
export async function saveFoodDraft(value: FoodDraft, database = db) {
  await database.foodDrafts.put(FoodDraftSchema.parse(value));
}
export async function saveFoodFile(file: FoodFile, database = db) {
  await database.foodFiles.add(FoodFileSchema.parse(file));
}
export async function imageFile(file: File): Promise<FoodFile> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw Error('Choose a PNG, JPEG or WebP image.');
  if (file.size > 5 * 1024 * 1024)
    throw Error('Images must be below 5 MB. Resize the image and try again.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error('Image could not be read.'));
    reader.readAsDataURL(file);
  });
  return FoodFileSchema.parse({
    id: uid(),
    name: file.name,
    mime: file.type,
    data,
    createdAt: now(),
  });
}
async function movement(
  database: TrainingDB,
  value: Omit<FoodData['movements'][number], 'id' | 'at'>,
) {
  await database.movements.add({ id: uid(), at: now(), ...value });
}
export async function saveStock(value: Stock, database = db) {
  const stock = StockSchema.parse(value);
  await database.transaction(
    'rw',
    [database.stock, database.ingredients, database.movements],
    async () => {
      if (!(await database.ingredients.get(stock.ingredientId)))
        throw Error('Choose an ingredient.');
      const previous = await database.stock.get(stock.id);
      if (
        previous &&
        (previous.ingredientId !== stock.ingredientId || previous.unit !== stock.unit)
      )
        throw Error(
          'Keep the ingredient and unit of an existing package; add a new package to use different units.',
        );
      await database.stock.put(stock);
      const change = stock.quantity - (previous?.quantity ?? 0);
      if (change || previous?.location !== stock.location)
        await movement(database, {
          stockId: stock.id,
          ingredientId: stock.ingredientId,
          quantity: change,
          unit: stock.unit,
          kind: previous ? (change ? 'adjusted' : 'moved') : 'added',
          notes: previous
            ? `Stock checked; ${stock.location}. ${stock.notes}`
            : 'Manually added stock',
        });
    },
  );
}
export async function wasteStock(id: string, quantity: number, reason: string, database = db) {
  if (!Number.isFinite(quantity) || quantity <= 0) throw Error('Enter a positive quantity.');
  await database.transaction('rw', [database.stock, database.movements], async () => {
    const s = await database.stock.get(id);
    if (!s || quantity > s.quantity) throw Error('Waste exceeds remaining stock.');
    const cost =
      s.price === undefined || !s.originalQuantity
        ? undefined
        : (s.price * quantity) / s.originalQuantity;
    await database.stock.update(id, { quantity: s.quantity - quantity });
    await movement(database, {
      stockId: id,
      ingredientId: s.ingredientId,
      quantity: -quantity,
      unit: s.unit,
      kind: 'waste',
      notes: reason,
      cost,
      currency: s.currency ?? 'GBP',
    });
  });
}
export async function cookRecipe(
  recipeId: string,
  servings: number,
  options: { date: string; location: string; expires?: string; notes?: string },
  database = db,
) {
  if (!Number.isFinite(servings) || servings <= 0) throw Error('Enter a positive portion count.');
  return database.transaction('rw', database.tables, async () => {
    const food = (await readData(database)).food!;
    const recipe = food.recipes.find((r) => r.id === recipeId);
    if (!recipe) throw Error('Recipe not found.');
    if (recipe.unmeasured)
      throw Error('Add measured quantities before cooking this meal into tracked portions.');
    if (!recipe.ingredients.some((i) => i.quantity > 0))
      throw Error('Add ingredient quantities before confirming cooking.');
    const stock = structuredClone(food.stock);
    const changes: {
      stockId: string;
      ingredientId: string;
      quantity: number;
      unit: Unit;
      cost?: number;
    }[] = [];
    for (const line of recipe.ingredients.filter((l) => l.quantity > 0)) {
      const ingredient = food.ingredients.find((i) => i.id === line.ingredientId)!;
      if (ingredient.state !== line.state)
        throw Error(
          `${ingredient.name}: raw/cooked state differs. Use a separate ingredient matching the recipe quantity.`,
        );
      let remaining = (line.quantity * servings) / recipe.servings;
      const packages = stock
        .filter((s) => s.ingredientId === line.ingredientId && usableStock(s, options.date))
        .sort(
          (a, b) =>
            (a.expires ?? '9999').localeCompare(b.expires ?? '9999') ||
            (a.purchased ?? '9999').localeCompare(b.purchased ?? '9999') ||
            a.id.localeCompare(b.id),
        );
      for (const pack of packages) {
        const available = convertQuantity(pack.quantity, pack.unit, line.unit, ingredient);
        if (available === undefined) continue;
        const used = Math.min(remaining, available);
        const deduction = convertQuantity(used, line.unit, pack.unit, ingredient)!;
        if (deduction <= 0) continue;
        pack.quantity = Math.max(0, pack.quantity - deduction);
        remaining -= used;
        changes.push({
          stockId: pack.id,
          ingredientId: ingredient.id,
          quantity: deduction,
          unit: pack.unit,
          cost:
            pack.price === undefined ||
            !pack.originalQuantity ||
            (pack.currency ?? 'GBP') !== food.foodSettings.currency
              ? undefined
              : (pack.price * deduction) / pack.originalQuantity,
        });
        if (remaining < 1e-8) break;
      }
      if (remaining > 1e-8)
        throw Error(
          `Not enough usable ${ingredient.name}: ${Number(remaining.toFixed(3))} ${line.unit} missing. Check stock or units first.`,
        );
    }
    const snapshot = recipeNutrition(food, recipe, 1);
    if (changes.every((c) => c.cost !== undefined))
      snapshot.cost = changes.reduce((s, c) => s + c.cost!, 0) / servings;
    const batch: Batch = BatchSchema.parse({
      id: uid(),
      recipeId,
      name: recipe.name,
      prepared: options.date,
      expires: options.expires,
      location: options.location,
      produced: servings,
      remaining: servings,
      snapshot,
      notes: options.notes ?? '',
      createdAt: now(),
    });
    for (const pack of stock)
      if (changes.some((c) => c.stockId === pack.id)) await database.stock.put(pack);
    await database.batches.add(batch);
    for (const change of changes)
      await movement(database, {
        ...change,
        quantity: -change.quantity,
        batchId: batch.id,
        kind: 'cooked',
        currency: food.foodSettings.currency,
        notes: `Prepared ${servings} portions of ${recipe.name}`,
      });
    return batch.id;
  });
}
export async function saveFoodEntry(value: FoodEntry, database = db) {
  const entry = FoodEntrySchema.parse(value);
  await database.transaction('rw', database.tables, async () => {
    if (entry.date > foodDay()) throw Error('Choose today or a past date for food eaten.');
    if (
      entry.unmeasured &&
      (entry.batchId ||
        entry.snapshot.cost !== undefined ||
        Object.values(entry.snapshot.macros).some((v) => v !== undefined))
    )
      throw Error('Unmeasured food cannot carry measured nutrition or prepared portions.');
    const old = await database.foodEntries.get(entry.id);
    if (old?.batchId) {
      const batch = await database.batches.get(old.batchId);
      if (!batch) throw Error('Original prepared batch is missing.');
      if (batch.remaining + old.servings > batch.produced + 1e-8)
        throw Error('Original batch balance is inconsistent.');
      await database.batches.update(batch.id, { remaining: batch.remaining + old.servings });
      await movement(database, {
        batchId: batch.id,
        quantity: old.servings,
        unit: 'portion',
        kind: 'adjusted',
        notes: 'Previous diary quantity returned before correction',
      });
    }
    if (entry.recipeId && !(await database.recipes.get(entry.recipeId)))
      throw Error('Recipe not found.');
    if (entry.batchId) {
      const batch = await database.batches.get(entry.batchId);
      if (!batch || batch.remaining + 1e-8 < entry.servings)
        throw Error('Not enough prepared portions remain.');
      if (entry.recipeId !== batch.recipeId)
        throw Error('Prepared portions belong to another recipe.');
      entry.snapshot = structuredClone(batch.snapshot);
      entry.name = batch.name;
      await database.batches.update(batch.id, {
        remaining: Math.max(0, batch.remaining - entry.servings),
      });
      await movement(database, {
        batchId: batch.id,
        quantity: -entry.servings,
        unit: 'portion',
        kind: 'eaten',
        notes: `${entry.date} ${entry.slot}`,
      });
    }
    await database.foodEntries.put(entry);
  });
}
export async function removeFoodEntry(id: string, database = db) {
  await database.transaction(
    'rw',
    [database.foodEntries, database.batches, database.movements],
    async () => {
      const entry = await database.foodEntries.get(id);
      if (!entry) return;
      if (entry.batchId) {
        const batch = await database.batches.get(entry.batchId);
        if (!batch || batch.remaining + entry.servings > batch.produced + 1e-8)
          throw Error('Prepared batch balance is inconsistent.');
        await database.batches.update(batch.id, { remaining: batch.remaining + entry.servings });
        await movement(database, {
          batchId: batch.id,
          quantity: entry.servings,
          unit: 'portion',
          kind: 'adjusted',
          notes: 'Diary entry deleted; portions returned',
        });
      }
      await database.foodEntries.delete(id);
    },
  );
}
export async function wasteBatch(id: string, quantity: number, notes: string, database = db) {
  if (!Number.isFinite(quantity) || quantity <= 0) throw Error('Enter a positive portion count.');
  await database.transaction('rw', [database.batches, database.movements], async () => {
    const batch = await database.batches.get(id);
    if (!batch || batch.remaining < quantity) throw Error('Not enough prepared portions remain.');
    await database.batches.update(id, { remaining: batch.remaining - quantity });
    await movement(database, {
      batchId: id,
      quantity: -quantity,
      unit: 'portion',
      kind: 'waste',
      notes,
      currency: batch.snapshot.currency ?? 'GBP',
      cost: batch.snapshot.cost === undefined ? undefined : batch.snapshot.cost * quantity,
    });
  });
}
export async function saveMealPlan(value: MealPlan, database = db) {
  const plan = MealPlanSchema.parse(value);
  await database.transaction('rw', database.tables, async () => {
    if (
      plan.occurrenceId &&
      (await database.mealPlans.toArray()).some(
        (p) => p.id !== plan.id && p.occurrenceId === plan.occurrenceId,
      )
    )
      throw Error('This programme meal is already planned. Edit its existing occurrence.');
    if (!(await database.recipes.get(plan.recipeId))) throw Error('Choose a recipe.');
    if (plan.batchId) {
      const batch = await database.batches.get(plan.batchId);
      if (!batch || batch.recipeId !== plan.recipeId)
        throw Error('Choose a matching prepared batch.');
    }
    await database.mealPlans.put(plan);
    for (const list of await database.shoppingLists.toArray())
      if (list.from && list.to) await regenerateShopping(list.id, database);
  });
}
export async function deleteMealPlan(id: string, database = db) {
  await database.transaction('rw', database.tables, async () => {
    const plan = await database.mealPlans.get(id);
    if (plan?.scheduleId && plan.occurrenceId) {
      const schedule = await database.foodSchedules.get(plan.scheduleId);
      if (schedule)
        await database.foodSchedules.put({
          ...schedule,
          omitted: [...new Set([...(schedule.omitted ?? []), plan.occurrenceId])],
          updatedAt: now(),
        });
    }
    await database.mealPlans.delete(id);
    for (const list of await database.shoppingLists.toArray())
      if (list.from && list.to) await regenerateShopping(list.id, database);
  });
}
export async function regenerateShopping(id: string, database = db) {
  await database.transaction('rw', database.tables, async () => {
    const food = (await readData(database)).food!;
    const list = food.shoppingLists.find((l) => l.id === id);
    if (!list) throw Error('Shopping list not found.');
    const generated = list.recipeId
      ? recipeAvailability(
          food,
          food.recipes.find((r) => r.id === list.recipeId)!,
          list.servings,
        )
      : planRequirements(food, list.from!, list.to!);
    // Retain handwritten rows and purchased/received rows. Never erase a manual addition.
    const retained = list.items.filter((i) => !i.generated || i.received);
    await database.shoppingLists.put({
      ...list,
      checklist: [
        ...new Set(
          (list.recipeId
            ? food.recipes.filter((r) => r.id === list.recipeId)
            : food.mealPlans
                .filter((p) => p.date >= list.from! && p.date <= list.to!)
                .flatMap((p) => food.recipes.filter((r) => r.id === p.recipeId))
          ).flatMap((r) =>
            r.unmeasured
              ? (r.composition ?? [])
                  .filter((c) => c.quantity === undefined)
                  .map((c) => c.ingredientId)
              : [],
          ),
        ),
      ].map((ingredientId) => ({
        id: 'checklist:' + ingredientId,
        ingredientId,
        name: food.ingredients.find((i) => i.id === ingredientId)?.name ?? 'Unknown ingredient',
        checked: list.checklist?.find((i) => i.ingredientId === ingredientId)?.checked ?? false,
        notes: 'Additional unmeasured demand. Review quantity; not received into stock.',
      })),
      items: [
        ...retained,
        ...generated
          .filter(
            (i) =>
              !retained.some(
                (r) =>
                  r.overridesRequirement && r.ingredientId === i.ingredientId && r.unit === i.unit,
              ),
          )
          .map((i) => {
            const old = list.items.find(
              (x) =>
                x.generated &&
                !x.received &&
                x.ingredientId === i.ingredientId &&
                x.unit === i.unit,
            );
            return {
              ...i,
              id: old?.id ?? i.id,
              checked: old?.quantity === i.quantity ? old.checked : false,
            };
          }),
      ],
      updatedAt: now(),
    });
  });
}
export async function saveShoppingList(list: ShoppingList, database = db) {
  await database.shoppingLists.put(ShoppingListSchema.parse({ ...list, updatedAt: now() }));
}
export async function savePurchase(
  value: Purchase,
  options: { allowDuplicate?: boolean; allowDiscrepancy?: boolean } = {},
  database = db,
) {
  const purchase = PurchaseSchema.parse(value);
  await database.transaction(
    'rw',
    [database.purchases, database.ingredients, database.foodFiles, database.foodDrafts],
    async () => {
      const duplicate = (await database.purchases.toArray()).find(
        (p) =>
          p.id !== purchase.id &&
          ((p.fingerprint && p.fingerprint === purchase.fingerprint) ||
            purchaseSignature(p) === purchaseSignature(purchase)),
      );
      if (duplicate && !options.allowDuplicate)
        throw Error(
          `Possible duplicate receipt: ${duplicate.retailer}, ${duplicate.date}. Confirm a separate purchase to continue.`,
        );
      const sum = purchase.lines.reduce((n, l) => n + l.paid, 0);
      if (Math.abs(sum - purchase.total) > 0.011 && !options.allowDiscrepancy)
        throw Error(
          'Line totals differ from the amount paid. Correct them or acknowledge the discrepancy.',
        );
      for (const line of purchase.lines)
        if (line.ingredientId && !(await database.ingredients.get(line.ingredientId)))
          throw Error('A matched ingredient no longer exists.');
      if (purchase.imageId && !(await database.foodFiles.get(purchase.imageId)))
        throw Error('Receipt image is missing.');
      const old = await database.purchases.get(purchase.id);
      if (old?.lines.some((l) => l.received))
        throw Error(
          'A received purchase is a historical record. Record a separate correction instead.',
        );
      await database.purchases.put(purchase);
      await database.foodDrafts.delete('purchase-editor');
      await database.foodDrafts.delete('purchase-text-editor');
    },
  );
}
export async function receivePurchase(id: string, database = db) {
  await database.transaction(
    'rw',
    [
      database.purchases,
      database.stock,
      database.ingredients,
      database.movements,
      database.foodSettings,
    ],
    async () => {
      const p = await database.purchases.get(id);
      if (!p) throw Error('Purchase not found.');
      const currency = (await database.foodSettings.get('food-preferences'))?.currency ?? 'GBP';
      const pending = p.lines.filter((l) => !l.received);
      if (pending.some((l) => !l.ingredientId || !l.quantity))
        throw Error(
          'Match every unreceived line to an ingredient and confirm its package size before receiving.',
        );
      for (const line of pending) {
        if (!(await database.ingredients.get(line.ingredientId!)))
          throw Error('Ingredient is missing.');
        const stockId = `purchase-stock:${p.id}:${line.id}`;
        if (await database.stock.get(stockId))
          throw Error('This purchase line already has stock; no quantities were added.');
        const quantity = line.quantity! * line.packages;
        await database.stock.add({
          id: stockId,
          ingredientId: line.ingredientId!,
          quantity,
          originalQuantity: quantity,
          unit: line.unit,
          packageSize: line.quantity,
          purchased: p.date,
          expires: line.expires,
          expiryKind: 'best-before',
          location: line.location,
          price: line.paid,
          currency: p.currency,
          purchaseId: p.id,
          purchaseLineId: line.id,
          brand: '',
          confidence: 'confirmed',
          notes: line.description,
          createdAt: now(),
        });
        await movement(database, {
          stockId,
          ingredientId: line.ingredientId!,
          quantity,
          unit: line.unit,
          kind: 'added',
          notes: `Received from ${p.retailer}`,
        });
      }
      await database.purchases.update(id, {
        lines: p.lines.map((l) => ({ ...l, received: true })),
      });
    },
  );
}
export async function receiveShopping(id: string, date = foodDay(), database = db) {
  await database.transaction('rw', database.tables, async () => {
    const list = await database.shoppingLists.get(id);
    if (!list) throw Error('Shopping list not found.');
    const selected = list.items.filter((i) => i.checked && !i.received);
    if (!selected.length) throw Error('Check the items you have bought first.');
    if (selected.some((i) => !i.ingredientId || !i.quantity))
      throw Error('Match checked items to ingredients and enter their received quantities.');
    for (const item of selected) {
      const ingredient = await database.ingredients.get(item.ingredientId!);
      if (!ingredient) throw Error('Ingredient not found.');
      const stockId = `shopping-stock:${list.id}:${item.id}`;
      if (await database.stock.get(stockId)) throw Error('This item has already been received.');
      await database.stock.add({
        id: stockId,
        ingredientId: ingredient.id,
        quantity: item.quantity,
        originalQuantity: item.quantity,
        unit: item.unit,
        location: ingredient.location,
        expiryKind: 'best-before',
        confidence: 'confirmed',
        brand: ingredient.brand,
        notes: `Received from ${list.name}; price not recorded`,
        purchased: date,
        createdAt: now(),
      });
      await movement(database, {
        stockId,
        ingredientId: ingredient.id,
        quantity: item.quantity,
        unit: item.unit,
        kind: 'added',
        notes: `Received shopping item: ${list.name}`,
      });
    }
    await database.shoppingLists.update(id, {
      items: list.items.map((i) =>
        selected.some((s) => s.id === i.id) ? { ...i, received: true } : i,
      ),
      updatedAt: now(),
    });
  });
}
