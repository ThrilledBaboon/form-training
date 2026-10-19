import { it, expect } from 'vitest';
import { sessionFixture } from './session-fixture';
import { foodFixture, foodTime } from './food-fixture';
import { FoodEntrySchema } from '../src/lib/food-model';
import { defaultWorkspace } from '../src/lib/workspace-model';
import { weeklyReview } from '../src/lib/weekly-review';
it('reviews recorded days only, excludes drafts and future sessions, and does not average unknown food as zero', () => {
  const data = sessionFixture();
  data.food = foodFixture();
  data.workspace = defaultWorkspace();
  data.food.foodEntries = [
    FoodEntrySchema.parse({
      id: 'known',
      date: '2026-10-12',
      slot: 'Lunch',
      name: 'Lunch',
      servings: 1,
      snapshot: {
        macros: { protein: 30, carbs: 40, fat: 10, fibre: 3 },
        missing: [],
        estimated: false,
      },
      createdAt: foodTime,
      updatedAt: foodTime,
    }),
    FoodEntrySchema.parse({
      id: 'unknown',
      date: '2026-10-13',
      slot: 'Lunch',
      name: 'Unknown',
      servings: 1,
      snapshot: { macros: {}, missing: ['Unknown'], estimated: true },
      createdAt: foodTime,
      updatedAt: foodTime,
    }),
  ];
  const r = weeklyReview(data, '2026-10-15');
  expect(r.from).toBe('2026-10-12');
  expect(r.foodDates).toHaveLength(2);
  expect(r.macros.protein).toEqual({ average: 30, knownDays: 1, unknownDays: 1 });
  expect(r.gym).toHaveLength(0);
  expect(r.previousGym).toBe(1);
  data.workspace.systems.food = false;
  const hidden = weeklyReview(data, '2026-10-15');
  expect(hidden.foodDates).toEqual([]);
  expect(hidden.macros.protein.average).toBeUndefined();
});
