import { IngredientSchema, RecipeSchema, emptyFood, type FoodData } from '../src/lib/food-model';
export const foodTime = '2026-10-17T12:00:00.000Z';
export function foodFixture(): FoodData {
  const food = structuredClone(emptyFood);
  food.ingredients = [
    IngredientSchema.parse({
      id: 'rice',
      name: 'Rice',
      state: 'raw',
      category: 'Grains',
      defaultUnit: 'g',
      basisUnit: 'g',
      macros: { protein: 8, carbs: 80, fat: 2, fibre: 1 },
      nutritionStatus: 'verified',
      source: 'Synthetic test label',
      package: { quantity: 500, unit: 'g' },
      createdAt: foodTime,
      updatedAt: foodTime,
    }),
    IngredientSchema.parse({
      id: 'milk',
      name: 'Milk',
      basisUnit: 'ml',
      defaultUnit: 'ml',
      density: 1.03,
      macros: { protein: 3, carbs: 5, fat: 4, fibre: 0 },
      nutritionStatus: 'manual',
      createdAt: foodTime,
      updatedAt: foodTime,
    }),
  ];
  food.recipes = [
    RecipeSchema.parse({
      id: 'rice-meal',
      name: 'Rice bowl',
      servings: 3,
      ingredients: [
        { id: 'line-rice', ingredientId: 'rice', quantity: 900, unit: 'g', state: 'raw' },
      ],
      steps: [{ id: 'step1', text: 'Cook according to the package.' }],
      createdAt: foodTime,
      updatedAt: foodTime,
    }),
  ];
  return food;
}
