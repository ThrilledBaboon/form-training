import { z } from 'zod';
import { db } from './db';
import { now } from './model';
import { FoodSettingsSchema, emptyFood, type FoodSettings } from './food-model';
export const activityNames = {
  low: 'Mostly seated · little planned activity',
  light: 'Light activity · some walking or training',
  moderate: 'Moderate activity · regular movement and training',
  high: 'High activity · active work and frequent training',
} as const;
export const FoodGoalInputsSchema = z.object({
  goal: z.enum(['maintain', 'lose', 'gain']),
  age: z.number().int().min(18).max(80),
  heightCm: z.number().finite().min(120).max(230),
  weightKg: z.number().finite().min(30).max(350),
  equation: z.enum(['male', 'female']),
  activity: z.enum(['low', 'light', 'moderate', 'high']),
});
export type FoodGoalInputs = z.infer<typeof FoodGoalInputsSchema>;
export type FoodGoalPreview = {
  targets: FoodSettings['targets'];
  calorieTarget: number;
  goal: FoodGoalInputs['goal'];
};
/** An editable starting estimate, never inferred from incomplete profile values. */
export function estimateFoodGoals(input: FoodGoalInputs): FoodGoalPreview {
  const c = FoodGoalInputsSchema.parse(input);
  const bmi = c.weightKg / (c.heightCm / 100) ** 2;
  if (c.goal === 'lose' && bmi < 18.5)
    throw Error(
      'Automatic weight-loss targets are unavailable at this height and weight. Choose maintenance or discuss suitable goals with a qualified professional.',
    );
  const resting =
    10 * c.weightKg + 6.25 * c.heightCm - 5 * c.age + (c.equation === 'male' ? 5 : -161);
  const maintenance = resting * { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 }[c.activity];
  const calorieTarget = Math.round(
    Math.max(resting, maintenance * { maintain: 1, lose: 0.9, gain: 1.1 }[c.goal]),
  );
  const protein = Math.round(Math.min(c.weightKg * 1.6, (calorieTarget * 0.3) / 4));
  const fat = Math.round((calorieTarget * 0.3) / 9);
  const carbs = Math.round((calorieTarget - protein * 4 - fat * 9) / 4);
  return { targets: { protein, carbs, fat, fibre: 30 }, calorieTarget, goal: c.goal };
}
export async function applyFoodGoals(
  preview: FoodGoalPreview,
  showCalories: boolean,
  database = db,
) {
  // Validate all fields before writing; only goal fields change, preserving budgets and locations.
  const fields = FoodSettingsSchema.pick({
    targets: true,
    calorieTarget: true,
    showCalories: true,
    goalSetup: true,
  }).parse({
    targets: preview.targets,
    calorieTarget: preview.calorieTarget,
    showCalories,
    goalSetup: { goal: preview.goal, method: 'mifflin-v1', generatedAt: now() },
  });
  return database.transaction('rw', database.foodSettings, async () => {
    const current = (await database.foodSettings.get('food-preferences')) ?? emptyFood.foodSettings;
    const settings = FoodSettingsSchema.parse({ ...current, ...fields });
    await database.foodSettings.put(settings);
    return settings;
  });
}
export async function setCalorieVisibility(showCalories: boolean, database = db) {
  return database.transaction('rw', database.foodSettings, async () => {
    const current = (await database.foodSettings.get('food-preferences')) ?? emptyFood.foodSettings;
    await database.foodSettings.put(FoodSettingsSchema.parse({ ...current, showCalories }));
  });
}
