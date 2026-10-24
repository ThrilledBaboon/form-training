import { z } from 'zod';
import { db, readData } from './db';
import { now, uid } from './model';
import {
  IngredientSchema,
  RecipeSchema,
  FoodProgrammeSchema,
  FoodFileSchema,
  emptyFood,
  validateFood,
  type FoodData,
} from './food-model';

export const FoodProgrammeLibrarySchema = z
  .object({
    app: z.literal('FORM'),
    type: z.literal('food-programme-library'),
    schemaVersion: z.literal(1),
    title: z.string().min(1).max(200),
    exportedAt: z.string().datetime({ offset: true }),
    ingredients: z.array(IngredientSchema).max(2000),
    recipes: z.array(RecipeSchema).max(2000),
    programmes: z.array(FoodProgrammeSchema).min(1).max(100),
    files: z.array(FoodFileSchema).max(100).default([]),
  })
  .strict();
export type FoodProgrammeLibrary = z.infer<typeof FoodProgrammeLibrarySchema>;
export function parseFoodProgrammeLibrary(input: string): FoodProgrammeLibrary {
  if (input.length > 20 * 1024 * 1024) throw Error('Programme files must be at most 20 MB.');
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw Error('Choose a valid FORM programme JSON file.');
  }
  const checked = FoodProgrammeLibrarySchema.safeParse(value);
  if (!checked.success)
    throw Error(
      'Invalid programme file: ' +
        checked.error.issues[0].path.join('.') +
        ' — ' +
        checked.error.issues[0].message,
    );
  const library = checked.data;
  validateFood({
    ...structuredClone(emptyFood),
    ingredients: library.ingredients,
    recipes: library.recipes,
    foodProgrammes: library.programmes,
    foodFiles: library.files,
  });
  return library;
}
export function foodProgrammeLibrary(food: FoodData, ids: string[]): FoodProgrammeLibrary {
  const programmes = food.foodProgrammes.filter((p) => ids.includes(p.id));
  const recipeIds = new Set(programmes.flatMap((p) => p.rotation.flatMap((r) => r.recipeIds)));
  const recipes = food.recipes.filter((r) => recipeIds.has(r.id));
  const ingredientIds = new Set([
    ...programmes.flatMap((p) => p.groups.flatMap((g) => g.ingredientIds)),
    ...recipes.flatMap((r) =>
      [...r.ingredients, ...(r.composition ?? [])].map((i) => i.ingredientId),
    ),
  ]);
  const fileIds = new Set(
    recipes.flatMap((r) => [r.imageId, ...r.steps.map((s) => s.imageId)]).filter(Boolean),
  );
  const library = {
    app: 'FORM',
    type: 'food-programme-library',
    schemaVersion: 1,
    title: programmes.length === 1 ? programmes[0].name : 'Food programmes',
    exportedAt: now(),
    ingredients: food.ingredients.filter((i) => ingredientIds.has(i.id)),
    recipes,
    programmes,
    files: food.foodFiles.filter((f) => fileIds.has(f.id)),
  };
  return parseFoodProgrammeLibrary(JSON.stringify(library));
}
const comparable = (row: unknown) =>
  JSON.stringify(row, (key, value) =>
    key === 'updatedAt' || key === 'createdAt' ? undefined : value,
  );
export function programmeImportPreview(food: FoodData, library: FoodProgrammeLibrary) {
  return (
    [
      ['ingredients', library.ingredients],
      ['recipes', library.recipes],
      ['foodProgrammes', library.programmes],
      ['foodFiles', library.files],
    ] as const
  ).map(([table, rows]) => ({
    table,
    total: rows.length,
    added: rows.filter((r) => !food[table].some((e) => e.id === r.id)).length,
    duplicates: rows.filter((r) =>
      food[table].some((e) => e.id === r.id && comparable(e) === comparable(r)),
    ).length,
    conflicts: rows.filter((r) =>
      food[table].some((e) => e.id === r.id && comparable(e) !== comparable(r)),
    ).length,
  }));
}
export async function importFoodProgrammeLibrary(
  value: FoodProgrammeLibrary,
  duplicate = false,
  database = db,
) {
  let library = parseFoodProgrammeLibrary(JSON.stringify(value));
  return database.transaction('rw', database.tables, async () => {
    const food = (await readData(database)).food!;
    const preview = programmeImportPreview(food, library);
    if (preview.some((p) => p.conflicts)) {
      if (!duplicate)
        throw Error(
          'Some IDs conflict with saved content. Keep your records and import a separate copy, or cancel.',
        );
      const ids = new Map(
        [...library.ingredients, ...library.recipes, ...library.programmes, ...library.files].map(
          (r) => [r.id, uid()],
        ),
      );
      const id = (old: string) => ids.get(old) ?? old;
      library = {
        ...library,
        ingredients: library.ingredients.map((r) => ({ ...r, id: id(r.id) })),
        files: library.files.map((r) => ({ ...r, id: id(r.id) })),
        recipes: library.recipes.map((r) => ({
          ...r,
          id: id(r.id),
          imageId: r.imageId ? id(r.imageId) : undefined,
          steps: r.steps.map((s) => ({ ...s, imageId: s.imageId ? id(s.imageId) : undefined })),
          ingredients: r.ingredients.map((i) => ({ ...i, ingredientId: id(i.ingredientId) })),
          composition: r.composition?.map((i) => ({ ...i, ingredientId: id(i.ingredientId) })),
        })),
        programmes: library.programmes.map((p) => ({
          ...p,
          id: id(p.id),
          name: p.name + ' (copy)',
          groups: p.groups.map((g) => ({ ...g, ingredientIds: g.ingredientIds.map(id) })),
          rotation: p.rotation.map((r) => ({ ...r, recipeIds: r.recipeIds.map(id) })),
        })),
      };
    }
    const combined = structuredClone(food);
    let added = 0;
    for (const [table, rows] of [
      ['ingredients', library.ingredients],
      ['recipes', library.recipes],
      ['foodProgrammes', library.programmes],
      ['foodFiles', library.files],
    ] as const) {
      const incoming = rows.filter((r) => !food[table].some((e) => e.id === r.id));
      Object.assign(combined, { [table]: [...combined[table], ...incoming] });
      added += incoming.length;
    }
    validateFood(combined);
    for (const [table, rows] of [
      ['ingredients', library.ingredients],
      ['recipes', library.recipes],
      ['foodProgrammes', library.programmes],
      ['foodFiles', library.files],
    ] as const) {
      const incoming = rows.filter((r) => !food[table].some((e) => e.id === r.id));
      if (incoming.length) await database.table(table).bulkAdd(incoming);
    }
    return added;
  });
}
