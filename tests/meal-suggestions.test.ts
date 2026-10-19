import { describe, it, expect } from 'vitest';
import { foodFixture, foodTime } from './food-fixture';
import { suggestMeals } from '../src/lib/meal-suggestions';
import { StockSchema, PurchaseSchema, FoodEntrySchema } from '../src/lib/food-model';
describe('saved recipe suggestions', () => {
  it('never treats unknown prices and times as free or instant; excludes drafts and archived recipes', () => {
    const f = foodFixture(),
      r = f.recipes[0];
    f.recipes.push({ ...r, id: 'draft', draft: true }, { ...r, id: 'archived', archived: true });
    expect(suggestMeals(f)).toHaveLength(1);
    expect(suggestMeals(f)[0].nutrition.cost).toBeUndefined();
    expect(suggestMeals(f, { maxCost: 5 })).toEqual([]);
    expect(suggestMeals(f, { maxMinutes: 30 })).toEqual([]);
    r.prepMinutes = 10;
    expect(suggestMeals(f, { maxMinutes: 30 })).toHaveLength(1);
  });
  it('uses one serving, compatible usable stock and recorded expiry without changing the food database', () => {
    const f = foodFixture();
    f.stock = [
      StockSchema.parse({
        id: 's',
        ingredientId: 'rice',
        quantity: 400,
        originalQuantity: 400,
        unit: 'g',
        location: 'Cupboard',
        expires: '2026-10-19',
        confidence: 'confirmed',
        createdAt: foodTime,
        updatedAt: foodTime,
      }),
    ];
    const before = structuredClone(f),
      options = { date: '2026-10-18' };
    const s = suggestMeals(f, options)[0];
    expect(s.nutrition.macros.protein).toBe(24);
    expect(s.available).toBe(true);
    expect(s.expiring).toEqual(['Rice']);
    expect(f).toEqual(before);
    f.stock[0].confidence = 'needs checking';
    expect(suggestMeals(f, options)[0].available).toBe(false);
    expect(suggestMeals(f, options)[0].expiring).toEqual([]);
    f.stock[0].confidence = 'confirmed';
    f.stock[0].expires = '2026-10-17';
    expect(suggestMeals(f, options)[0].available).toBe(false);
  });
  it('ranks known recorded cost and quick times before unknown values', () => {
    const f = foodFixture(),
      r = f.recipes[0];
    r.prepMinutes = 20;
    f.recipes.push({
      ...r,
      id: 'unknown',
      name: 'A mystery',
      prepMinutes: 0,
      ingredients: [
        {
          id: 'm',
          ingredientId: 'milk',
          quantity: 200,
          unit: 'ml',
          state: 'raw',
          optional: false,
          notes: '',
        },
      ],
    });
    f.purchases = [
      PurchaseSchema.parse({
        id: 'p',
        reviewed: true,
        date: '2026-10-17',
        retailer: 'Shop',
        currency: 'GBP',
        total: 2,
        lines: [
          {
            id: 'l',
            description: 'Rice',
            ingredientId: 'rice',
            quantity: 1000,
            unit: 'g',
            packages: 1,
            paid: 2,
            discount: 0,
            received: false,
          },
        ],
        createdAt: foodTime,
        updatedAt: foodTime,
      }),
    ];
    expect(suggestMeals(f, { priority: 'quick' })[0].recipe.id).toBe(r.id);
    expect(suggestMeals(f, { priority: 'cost' })[0].recipe.id).toBe(r.id);
    expect(suggestMeals(f, { maxCost: 1 })[0].nutrition.cost).toBeCloseTo(0.6);
  });
  it('does not fill missing macros or count planned meals as eaten', () => {
    const f = foodFixture();
    f.foodSettings.targets = { protein: 100 };
    f.ingredients[0].macros.protein = undefined;
    expect(suggestMeals(f)[0].reasons.join()).toContain('Macro fit unavailable');
    expect(suggestMeals(f)[0].nutrition.macros.protein).toBeUndefined();
    f.ingredients[0].macros.protein = 8;
    expect(suggestMeals(f)[0].reasons.join()).toContain('remaining protein');
    f.foodEntries = [
      FoodEntrySchema.parse({
        id: 'e',
        date: '2026-10-18',
        slot: 'Lunch',
        name: 'Incomplete',
        servings: 1,
        snapshot: { macros: {}, missing: ['Unknown'], estimated: true, ingredients: [] },
        notes: '',
        createdAt: foodTime,
        updatedAt: foodTime,
      }),
    ];
    expect(suggestMeals(f, { date: '2026-10-18' })[0].reasons.join()).toContain(
      'Macro fit unavailable',
    );
    expect(f.foodSettings.showCalories).toBe(false);
  });
});
