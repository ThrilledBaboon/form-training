import { describe, it, expect } from 'vitest';
import { foodFixture, foodTime } from './food-fixture';
import { fixture } from './fixtures';
import { categoryExport, dataCategories, foodCsv, foodCsvKinds } from '../src/lib/category-backup';
import { parseBackup, serialise, csvExport, importBackup } from '../src/lib/backup';
import { TrainingDB, readData } from '../src/lib/db';
import { uid } from '../src/lib/model';
import { parseReceiptText, reviewableReceiptText } from '../src/lib/receipts';
import { FoodFileSchema, readFoodDraft } from '../src/lib/food-model';
describe('category portability and receipt extraction', () => {
  it('round trips a 7300-entry food archive with shared recipe dependencies', () => {
    const data = { ...fixture(), food: foodFixture() };
    data.food.foodEntries = Array.from({ length: 7300 }, (_, index) => ({
      id: 'food-history-' + index,
      date: new Date(Date.UTC(2006, 0, index + 1)).toISOString().slice(0, 10),
      slot: 'Dinner' as const,
      name: 'Rice bowl',
      recipeId: 'rice-meal',
      servings: 1,
      snapshot: {
        macros: { protein: 24, carbs: 240, fat: 6, fibre: 3 },
        missing: [],
        estimated: false,
        ingredients: data.food.recipes[0].ingredients.map((line) => ({
          ...line,
          quantity: line.quantity / 3,
        })),
      },
      notes: 'Synthetic archive row',
      createdAt: foodTime,
    }));
    const restored = parseBackup(categoryExport(data, ['diary']));
    expect(restored.data.food.foodEntries).toEqual(data.food.foodEntries);
    expect(restored.data.food.recipes).toEqual(data.food.recipes);
    expect(restored.data.food.ingredients).toHaveLength(1);
    expect(restored.data.sessions).toEqual([]);
  });
  it('produces independently valid exports for every supported category', () => {
    const data = { ...fixture(), food: foodFixture() };
    for (const key of Object.keys(dataCategories) as (keyof typeof dataCategories)[]) {
      const file = parseBackup(categoryExport(data, [key]));
      expect(file.scope).toBe('categories');
      expect(file.manifest?.requested).toEqual([key]);
    }
    const recipes = parseBackup(categoryExport(data, ['recipes']));
    expect(recipes.data.food.ingredients).toHaveLength(1);
    expect(recipes.data.food.recipes).toHaveLength(1);
    expect(recipes.data.sessions).toEqual([]);
    expect(recipes.data.routines).toEqual([]);
  });
  it('preserves attached files and historical dependencies for prepared food entries', () => {
    const data = { ...fixture(), food: foodFixture() };
    const f = data.food;
    f.foodFiles = [
      {
        id: 'photo',
        name: 'test.png',
        mime: 'image/png',
        data: 'data:image/png;base64,AA==',
        createdAt: foodTime,
      },
    ];
    f.recipes[0].imageId = 'photo';
    const snapshot = {
      macros: { protein: 24 },
      missing: ['Other values unknown'],
      estimated: true,
      ingredients: f.recipes[0].ingredients,
    };
    f.batches = [
      {
        id: 'batch',
        recipeId: 'rice-meal',
        name: 'Rice bowl',
        prepared: '2026-10-17',
        location: 'Fridge',
        produced: 3,
        remaining: 2,
        snapshot,
        notes: '',
        createdAt: foodTime,
      },
    ];
    f.foodEntries = [
      {
        id: 'entry',
        recipeId: 'rice-meal',
        batchId: 'batch',
        date: '2026-10-17',
        slot: 'Dinner',
        name: 'Rice bowl',
        servings: 1,
        snapshot,
        notes: 'Historical note',
        createdAt: foodTime,
      },
    ];
    const restored = parseBackup(categoryExport(data, ['diary']));
    expect(restored.data.food.foodFiles).toEqual(f.foodFiles);
    expect(restored.data.food.batches).toEqual(f.batches);
    expect(restored.data.food.foodEntries).toEqual(f.foodEntries);
  });
  it('imports category preferences only when explicitly selected and never permits category replacement', async () => {
    const database = new TrainingDB('category-' + uid());
    await database.open();
    try {
      const data = { ...fixture(), food: foodFixture() };
      data.settings.unit = 'lb';
      data.food.foodSettings.targets.protein = 140;
      const file = parseBackup(categoryExport(data, ['preferences', 'foodPreferences']));
      await importBackup(file, 'merge', database);
      expect((await readData(database)).settings.unit).toBe('kg');
      await importBackup(file, 'merge', database, { restorePreferences: true });
      expect((await readData(database)).settings.unit).toBe('lb');
      expect((await readData(database)).food?.foodSettings.targets.protein).toBe(140);
      await expect(importBackup(file, 'replace', database)).rejects.toThrow('merge only');
    } finally {
      await database.delete();
    }
  });
  it('omits retired metrics from every readable report, complete backup and category file', () => {
    const data = { ...fixture(), food: foodFixture() };
    data.sessions[0].calories = 999;
    expect(serialise(data)).not.toMatch(/calorie|kcal/i);
    expect(categoryExport(data, ['workouts'])).not.toMatch(/calorie|kcal/i);
    for (const kind of ['sessions', 'sets', 'exercises', 'bodyweight'] as const)
      expect(csvExport(data, kind)).not.toMatch(/calorie|kcal/i);
    for (const kind of foodCsvKinds) expect(foodCsv(data.food, kind)).not.toMatch(/calorie|kcal/i);
  });
  it('extracts editable receipt suggestions without assuming ingredient identity or missing package sizes', () => {
    const result = parseReceiptText(
      'TEST MARKET\n17/10/2026\nRICE 500g 2.00\nDISCOUNT -0.50\nMILK 1.50\nTOTAL 3.00\nCARD 3.00',
    );
    expect(result).toMatchObject({ retailer: 'TEST MARKET', date: '2026-10-17', total: 3 });
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ quantity: 500, unit: 'g', paid: 1.5, discount: 0.5 });
    expect(result.lines[1].quantity).toBeUndefined();
    expect(result.lines.every((l) => l.ingredientId === undefined)).toBe(true);
    expect(reviewableReceiptText('RICE 2.00\nCalories 100\nTOTAL 2.00')).toBe(
      'RICE 2.00\nTOTAL 2.00',
    );
  });
  it('validates attachment manifests and MIME types, and resumes only safe editor drafts', () => {
    const data = { ...fixture(), food: foodFixture() };
    const file = JSON.parse(serialise(data));
    file.manifest.attachments = 1;
    expect(() => parseBackup(JSON.stringify(file))).toThrow('attachment count');
    expect(
      FoodFileSchema.safeParse({
        id: 'image',
        name: 'x.png',
        mime: 'image/png',
        data: 'data:image/jpeg;base64,AA==',
        createdAt: foodTime,
      }).success,
    ).toBe(false);
    expect(readFoodDraft('recipe', '{"id":"r","ingredients":[null]}')).toBeUndefined();
    expect(
      readFoodDraft('recipe', JSON.stringify({ ...data.food.recipes[0], name: '', servings: 0 })),
    ).toMatchObject({ name: '', servings: 0 });
    expect(
      readFoodDraft('ingredient', JSON.stringify({ ...data.food.ingredients[0], name: '' })),
    ).toMatchObject({ name: '' });
  });
  it('exports checkout totals once per receipt including purchases without product lines', () => {
    const f = foodFixture();
    const purchase = {
      id: 'p',
      date: '2026-10-17',
      retailer: 'Market',
      currency: 'GBP',
      total: 9.87,
      lines: [],
      notes: '',
      reviewed: true as const,
      createdAt: foodTime,
    };
    f.purchases = [purchase];
    expect(foodCsv(f, 'purchases')).toContain('9.87');
    f.purchases[0].lines = [
      {
        id: 'a',
        description: 'Rice',
        packages: 1,
        unit: 'g',
        paid: 4,
        discount: 0,
        received: false,
        location: 'Cupboard',
      },
      {
        id: 'b',
        description: 'Milk',
        packages: 1,
        unit: 'ml',
        paid: 5.87,
        discount: 0,
        received: false,
        location: 'Fridge',
      },
    ];
    expect(foodCsv(f, 'purchases').match(/9\.87/g)).toHaveLength(1);
  });
});
