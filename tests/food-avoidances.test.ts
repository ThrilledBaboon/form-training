import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import { now, uid } from '../src/lib/model';
import { BatchSchema, FoodScheduleSchema } from '../src/lib/food-model';
import { fillingBowlStarter } from '../src/lib/food-programme-starter';
import { importFoodProgrammeLibrary } from '../src/lib/food-programme-library';
import { checkInMeal, fillFoodSchedule, startFoodSchedule } from '../src/lib/food-programmes';
import { deleteMealPlan } from '../src/lib/food-actions';
import {
  FoodAvoidanceReviewChanged,
  previewFoodAvoidances,
  saveFoodAvoidances,
} from '../src/lib/food-avoidances';

const today = '2026-10-24';
let database: TrainingDB;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
  database = new TrainingDB('food-avoidances-' + uid());
  await database.open();
});
afterEach(async () => {
  await database.delete();
  vi.useRealTimers();
});
const food = async () => (await readData(database)).food!;

async function setup() {
  const library = fillingBowlStarter();
  await importFoodProgrammeLibrary(library, false, database);
  const tuna = library.recipes.find((recipe) => recipe.name === 'Tuna kimchi bowl')!;
  const chicken = library.recipes.find((recipe) => recipe.name === 'Chicken cucumber bowl')!;
  const tunaIngredient = library.ingredients.find((ingredient) => ingredient.name === 'Tuna')!;
  const chickenIngredient = library.ingredients.find(
    (ingredient) => ingredient.name === 'Chicken breast',
  )!;
  const programme = library.programmes[0];
  const schedule = FoodScheduleSchema.parse({
    id: 'my-food-schedule',
    programmeId: programme.id,
    snapshot: {
      ...programme,
      cycleDays: 1,
      rotation: [
        { day: 0, slot: 'Lunch', recipeIds: [tuna.id, chicken.id] },
        { day: 0, slot: 'Dinner', recipeIds: [tuna.id] },
      ],
    },
    start: '2026-10-23',
    days: 5,
    slots: ['Lunch', 'Dinner'],
    status: 'active',
    createdAt: now(),
    updatedAt: now(),
  });
  await startFoodSchedule(schedule, database);
  const plan = (date: string, slot = 'Lunch') => `${schedule.id}:${date}:${slot}`;
  return { schedule, tuna, chicken, tunaIngredient, chickenIngredient, plan };
}

describe('programme foods to avoid', () => {
  it('previews replacements and explicit empty slots without writing any data', async () => {
    const { schedule, tunaIngredient, chicken } = await setup();
    const before = await food();
    const preview = previewFoodAvoidances(before, schedule.id, [tunaIngredient.id]);
    expect(preview.changes).toHaveLength(8);
    expect(
      preview.changes
        .filter((change) => change.replacement)
        .map((change) => change.replacement!.id),
    ).toEqual(Array(4).fill(chicken.id));
    expect(preview.changes.filter((change) => !change.replacement)).toHaveLength(4);
    expect(preview.changes.every((change) => change.plan.date >= today)).toBe(true);
    expect(await food()).toEqual(before);
  });

  it('preserves safe swaps, omissions, manual and other programmes, past meals, diary and prepared portions', async () => {
    const { schedule, plan, tuna, chicken, tunaIngredient } = await setup();
    await checkInMeal(
      (await database.mealPlans.get(plan(today)))!,
      { notes: 'I already ate this.' },
      database,
    );
    await database.mealPlans.update(plan('2026-10-25'), {
      recipeId: chicken.id,
      servings: 2,
      notes: 'My chosen swap',
    });
    await deleteMealPlan(plan('2026-10-26', 'Dinner'), database);
    await database.mealPlans.put({
      ...(await database.mealPlans.get(plan('2026-10-25', 'Dinner')))!,
      id: 'manual-tuna',
      scheduleId: undefined,
      occurrenceId: undefined,
      notes: 'My manual meal',
    });
    await database.foodSchedules.put({ ...schedule, id: 'other-food-schedule', status: 'paused' });
    await database.mealPlans.put({
      ...(await database.mealPlans.get(plan('2026-10-26')))!,
      id: 'other-programme-tuna',
      scheduleId: 'other-food-schedule',
      occurrenceId: 'other-food-schedule:2026-10-26:Lunch',
    });
    await database.batches.put(
      BatchSchema.parse({
        id: 'prepared-tuna',
        recipeId: tuna.id,
        name: 'Prepared tuna',
        prepared: today,
        location: 'Fridge',
        produced: 2,
        remaining: 2,
        snapshot: { macros: {}, missing: [], estimated: false, ingredients: [] },
        createdAt: now(),
      }),
    );
    await database.mealPlans.update(plan('2026-10-27'), {
      batchId: 'prepared-tuna',
      notes: 'Keep my note',
    });
    const before = await food();
    const preview = previewFoodAvoidances(before, schedule.id, [tunaIngredient.id]);
    expect(preview.changes).toHaveLength(5);
    expect(await saveFoodAvoidances(preview, database)).toBe(5);
    const after = await food();
    for (const id of [
      plan('2026-10-23'),
      plan('2026-10-23', 'Dinner'),
      plan(today),
      plan('2026-10-25'),
      'manual-tuna',
      'other-programme-tuna',
    ])
      expect(after.mealPlans.find((value) => value.id === id)).toEqual(
        before.mealPlans.find((value) => value.id === id),
      );
    expect(after.mealPlans.find((value) => value.id === plan('2026-10-27'))).toMatchObject({
      recipeId: chicken.id,
      notes: 'Keep my note',
    });
    expect(
      after.mealPlans.find((value) => value.id === plan('2026-10-27'))?.batchId,
    ).toBeUndefined();
    expect(after.foodSchedules.find((value) => value.id === schedule.id)?.omitted).toContain(
      plan('2026-10-26', 'Dinner'),
    );
    expect(after.foodSchedules.find((value) => value.id === 'other-food-schedule')).toEqual(
      before.foodSchedules.find((value) => value.id === 'other-food-schedule'),
    );
    for (const key of Object.keys(before) as (keyof typeof before)[])
      if (key !== 'foodSchedules' && key !== 'mealPlans') expect(after[key]).toEqual(before[key]);
  });

  it('leaves removed slots omitted when choices are later cleared and repeated planning runs', async () => {
    const { schedule, tunaIngredient, chickenIngredient } = await setup();
    await saveFoodAvoidances(
      previewFoodAvoidances(await food(), schedule.id, [tunaIngredient.id, chickenIngredient.id]),
      database,
    );
    const afterAvoiding = await food();
    expect(afterAvoiding.mealPlans).toHaveLength(2);
    expect(afterAvoiding.foodSchedules[0].omitted).toHaveLength(8);
    await saveFoodAvoidances(previewFoodAvoidances(afterAvoiding, schedule.id, []), database);
    expect(await fillFoodSchedule(schedule.id, today, database)).toBe(0);
    const beforeRepeat = await food();
    expect(
      await saveFoodAvoidances(previewFoodAvoidances(beforeRepeat, schedule.id, []), database),
    ).toBe(0);
    expect(await food()).toEqual(beforeRepeat);
  });

  it.each(['logged', 'swap', 'recipe'] as const)(
    'rejects a stale review after a concurrent %s change without writing preferences or meals',
    async (change) => {
      const { schedule, plan, chicken, tunaIngredient } = await setup();
      const preview = previewFoodAvoidances(await food(), schedule.id, [tunaIngredient.id]);
      if (change === 'logged')
        await checkInMeal((await database.mealPlans.get(plan(today)))!, {}, database);
      if (change === 'swap')
        await database.mealPlans.update(plan(today), {
          recipeId: chicken.id,
          notes: 'Changed elsewhere',
        });
      if (change === 'recipe')
        await database.recipes.update(chicken.id, {
          composition: [
            ...chicken.composition!,
            { ingredientId: tunaIngredient.id, role: 'protein', state: 'as sold', guidance: '' },
          ],
        });
      const concurrent = await food();
      await expect(saveFoodAvoidances(preview, database)).rejects.toBeInstanceOf(
        FoodAvoidanceReviewChanged,
      );
      expect(await food()).toEqual(concurrent);
    },
  );

  it('supports paused programmes, rejects unknown foods or ended schedules and requires a fresh review after midnight', async () => {
    const { schedule, tunaIngredient } = await setup();
    const original = await food();
    expect(() => previewFoodAvoidances(original, schedule.id, ['unknown'])).toThrow(/ingredient/);
    await database.foodSchedules.update(schedule.id, { status: 'paused' });
    const review = previewFoodAvoidances(await food(), schedule.id, [tunaIngredient.id]);
    expect(await saveFoodAvoidances(review, database)).toBe(8);
    const nextReview = previewFoodAvoidances(await food(), schedule.id, []);
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    const before = await food();
    await expect(saveFoodAvoidances(nextReview, database)).rejects.toBeInstanceOf(
      FoodAvoidanceReviewChanged,
    );
    expect(await food()).toEqual(before);
    await database.foodSchedules.update(schedule.id, { status: 'completed' });
    const ended = await food();
    expect(() => previewFoodAvoidances(ended, schedule.id, [])).toThrow(/ended/);
  });
});
