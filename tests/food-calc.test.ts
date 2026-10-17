import { describe, it, expect } from 'vitest';
import { foodFixture, foodTime } from './food-fixture';
import {
  convertQuantity,
  lineNutrition,
  recipeNutrition,
  requirements,
  priceFor,
  addMacros,
  scaleMacros,
  dailyMacros,
  weekDays,
} from '../src/lib/food-calc';
import { MacroSchema } from '../src/lib/food-model';
describe('food calculations', () => {
  it('converts mass and volume independently and requires density across dimensions', () => {
    const f = foodFixture();
    expect(convertQuantity(1, 'kg', 'g')).toBe(1000);
    expect(convertQuantity(2, 'l', 'ml')).toBe(2000);
    expect(convertQuantity(100, 'ml', 'g', f.ingredients[0])).toBeUndefined();
    expect(convertQuantity(100, 'ml', 'g', f.ingredients[1])).toBe(103);
    expect(convertQuantity(103, 'g', 'ml', f.ingredients[1])).toBe(100);
    expect(convertQuantity(2, 'count', 'g', { ...f.ingredients[0], gramsPerCount: 50 })).toBe(100);
  });
  it('calculates ingredient contributions, whole recipes and per-serving scaling', () => {
    const f = foodFixture(),
      r = f.recipes[0];
    expect(recipeNutrition(f, r).macros.protein).toBe(72);
    expect(recipeNutrition(f, r, 1).macros.protein).toBe(24);
    expect(recipeNutrition(f, r, 6).macros.carbs).toBe(1440);
    expect(
      lineNutrition({ ...r.ingredients[0], quantity: 200 }, f.ingredients[0]).macros.protein,
    ).toBe(16);
  });
  it('never applies raw data to cooked quantities and never fabricates missing macros', () => {
    const f = foodFixture();
    const cooked = lineNutrition(
      { ...f.recipes[0].ingredients[0], state: 'cooked' },
      f.ingredients[0],
    );
    expect(cooked.macros.protein).toBeUndefined();
    expect(cooked.missing[0]).toContain('cooked');
    const partial = lineNutrition(f.recipes[0].ingredients[0], {
      ...f.ingredients[0],
      macros: { protein: 8 },
    });
    expect(partial.macros.protein).toBe(72);
    expect(partial.macros.carbs).toBeUndefined();
    expect(partial.missing.length).toBe(3);
  });
  it('allows zero quantities and recalculates substitutions from the selected source', () => {
    const f = foodFixture();
    const line = f.recipes[0].ingredients[0];
    expect(lineNutrition({ ...line, quantity: 0 }).macros.protein).toBe(0);
    const replacement = {
      ...line,
      ingredientId: 'milk',
      unit: 'ml' as const,
      state: 'as sold' as const,
      quantity: 100,
    };
    expect(
      recipeNutrition(f, { ...f.recipes[0], ingredients: [replacement] }, 3).macros.protein,
    ).toBe(3);
  });
  it('aggregates intake with portion sizes and retains unknown totals', () => {
    const f = foodFixture();
    f.foodEntries = [
      {
        id: 'entry',
        date: '2026-10-17',
        slot: 'Dinner',
        name: 'Rice',
        servings: 2,
        snapshot: recipeNutrition(f, f.recipes[0], 1),
        notes: '',
        createdAt: foodTime,
      },
    ];
    expect(dailyMacros(f, '2026-10-17').protein).toBe(48);
    expect(addMacros([{ protein: 3 }, {}]).protein).toBeUndefined();
    expect(scaleMacros({ fat: 4 }, 0.5).fat).toBe(2);
  });
  it('subtracts inventory before rounding package sizes and aggregates shared ingredients', () => {
    const f = foodFixture();
    f.stock = [
      {
        id: 'stock',
        ingredientId: 'rice',
        quantity: 350,
        originalQuantity: 350,
        unit: 'g',
        location: 'Cupboard',
        expiryKind: 'best-before',
        brand: '',
        confidence: 'confirmed',
        notes: '',
        createdAt: foodTime,
      },
    ];
    const shopping = requirements(
      f,
      [
        { recipeId: 'rice-meal', servings: 1 },
        { recipeId: 'rice-meal', servings: 2 },
      ],
      '2026-10-17',
    );
    expect(shopping).toHaveLength(1);
    expect(shopping[0]).toMatchObject({ shortage: 550, quantity: 1000, packages: 2 });
  });
  it('excludes expired or unchecked stock and already prepared portions from shopping', () => {
    const f = foodFixture();
    f.stock = [
      {
        id: 's',
        ingredientId: 'rice',
        quantity: 5000,
        originalQuantity: 5000,
        unit: 'g',
        expires: '2026-10-16',
        location: 'Cupboard',
        expiryKind: 'use-by',
        brand: '',
        confidence: 'confirmed',
        notes: '',
        createdAt: foodTime,
      },
    ];
    expect(
      requirements(f, [{ recipeId: 'rice-meal', servings: 3 }], '2026-10-17')[0].shortage,
    ).toBe(900);
    expect(requirements(f, [{ recipeId: 'rice-meal', servings: 3, batchId: 'prepared' }])).toEqual(
      [],
    );
  });
  it('prorates net purchase prices rather than counting a whole package per use', () => {
    const f = foodFixture();
    f.purchases = [
      {
        id: 'p',
        retailer: 'Test shop',
        date: '2026-10-17',
        currency: 'GBP',
        lines: [
          {
            id: 'l',
            description: 'Rice',
            ingredientId: 'rice',
            quantity: 500,
            packages: 1,
            unit: 'g',
            paid: 2,
            discount: 0.5,
            received: false,
            location: 'Cupboard',
          },
        ],
        total: 2,
        notes: '',
        reviewed: true,
        createdAt: foodTime,
      },
    ];
    expect(priceFor(f, 'rice', 100, 'g')).toBeCloseTo(0.4);
    expect(priceFor(f, 'rice', 1, 'kg')).toBeCloseTo(4);
    expect(priceFor(f, 'milk', 100, 'ml')).toBeUndefined();
  });
  it('allocates expiring packages to dated meals in order without using expired future stock', () => {
    const f = foodFixture();
    const pack = {
      id: 'early',
      ingredientId: 'rice',
      quantity: 300,
      originalQuantity: 300,
      unit: 'g' as const,
      expires: '2026-10-18',
      location: 'Cupboard',
      expiryKind: 'best-before' as const,
      brand: '',
      confidence: 'confirmed' as const,
      notes: '',
      createdAt: foodTime,
    };
    f.stock = [pack, { ...pack, id: 'late', expires: '2026-10-25' }];
    const selections = [
      { recipeId: 'rice-meal', servings: 2, date: '2026-10-20' },
      { recipeId: 'rice-meal', servings: 1, date: '2026-10-17' },
    ];
    expect(requirements(f, selections, '2026-10-17')[0].shortage).toBe(300);
    expect(requirements(f, selections.slice(0, 1), '2026-10-17')[0].shortage).toBe(300);
    f.recipes[0].ingredients[0].state = 'cooked';
    expect(requirements(f, selections.slice(1), '2026-10-17')[0]).toMatchObject({
      shortage: 300,
      notes: expect.stringContaining('Food state differs'),
    });
  });
  it('handles local calendar weeks and rejects unsupported nutrient fields', () => {
    expect(weekDays('2026-10-17')[0]).toBe('2026-10-12');
    expect(MacroSchema.safeParse({ protein: 5, calories: 100 }).success).toBe(false);
  });
});
