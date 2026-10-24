import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fillingBowlStarter } from '../src/lib/food-programme-starter';
import { fillingBowlGuides } from '../src/lib/food-programme-recipe-guides';

describe('filling-bowl cooking guides', () => {
  it('reconstructs the original installed starter exactly for safe update comparisons', () => {
    // Captured from the original implementation before adding cooking guides.
    const hash = createHash('sha256')
      .update(JSON.stringify(fillingBowlStarter(1)))
      .digest('hex');
    expect(hash).toBe('5c6f4e237c145e78262602082f809f64d356fa37ad92e6e85a483533fc764a4a');
  });

  it('preserves reusable IDs, ingredient records and rotation while improving every meal', () => {
    const previous = fillingBowlStarter(1);
    const current = fillingBowlStarter();
    expect(current.programmes[0].contentVersion).toBe(2);
    expect(current.ingredients).toEqual(previous.ingredients);
    expect(current.recipes.map((recipe) => recipe.id)).toEqual(
      previous.recipes.map((recipe) => recipe.id),
    );
    expect(current.programmes[0].rotation).toEqual(previous.programmes[0].rotation);
    expect(current.recipes).toHaveLength(18);
    expect(new Set(current.recipes.map((recipe) => recipe.description)).size).toBe(18);

    current.recipes.forEach((recipe, index) => {
      const original = previous.recipes[index];
      expect(recipe.steps.length).toBeGreaterThanOrEqual(3);
      expect(recipe.steps.length).toBeLessThanOrEqual(6);
      expect(recipe.steps).not.toEqual(original.steps);
      expect(recipe.prepMinutes).toBeGreaterThan(0);
      expect(recipe.equipment.length).toBeGreaterThan(1);
      expect(recipe.notes).toContain('times are estimates');
      expect(recipe.notes).toContain('have not been kitchen-tested');
      // The upgrade adds flavourings, not another fat portion or a different meal.
      expect(
        recipe
          .composition!.filter((line) => line.role !== 'flavouring')
          .map((line) => line.ingredientId),
      ).toEqual(
        original
          .composition!.filter((line) => line.role !== 'flavouring')
          .map((line) => line.ingredientId),
      );
    });
  });

  it('lists every cooking-guide ingredient and keeps household suggestions out of measured nutrition', () => {
    const library = fillingBowlStarter();
    for (const recipe of library.recipes) {
      const guide = fillingBowlGuides[recipe.name];
      const names = recipe.composition!.map(
        (line) =>
          library.ingredients.find((ingredient) => ingredient.id === line.ingredientId)!.name,
      );
      expect(names.slice().sort()).toEqual(Object.keys(guide.portions).sort());
      expect(recipe.unmeasured).toBe(true);
      expect(recipe.ingredients).toEqual([]);
      expect(
        recipe.composition!.every(
          (line) =>
            line.quantity === undefined && line.unit === undefined && line.guidance.length > 0,
        ),
      ).toBe(true);
    }
  });

  it('makes the dinner example usable, with listed seasoning, pan instructions and a doneness check', () => {
    const library = fillingBowlStarter();
    const recipe = library.recipes.find((row) => row.name === 'Chicken courgette bowl')!;
    const text = recipe.steps.map((step) => step.text).join(' ');
    const ingredientIds = recipe.composition!.map((line) => line.ingredientId);
    expect(ingredientIds).toContain('filling-v1-garlic');
    expect(ingredientIds).toContain('filling-v1-lemon');
    expect(ingredientIds).toContain('filling-v1-herbs-and-spices');
    expect(text).toContain('grate the cauliflower');
    expect(text).toContain('non-stick pan over medium-high heat');
    expect(text).toContain('75°C for 30 seconds');
    expect(text).toContain('remaining olive oil');
  });

  it('distinguishes ready-to-eat cold salads from raw meat or seafood requiring cooking', () => {
    const library = fillingBowlStarter();
    const coldNames = [
      'Chicken cucumber bowl',
      'Chicken cabbage bowl',
      'Chicken avocado salad bowl',
      'Prawn avocado salad bowl',
    ];
    for (const name of coldNames) {
      const recipe = library.recipes.find((row) => row.name === name)!;
      expect(recipe.cookMinutes).toBe(0);
      expect(recipe.steps[0].text).toContain('ready to eat');
      expect(recipe.notes).toContain('raw');
      expect(recipe.notes).toContain('75°C for 30 seconds');
      expect(recipe.notes).toContain('cool');
    }
    for (const name of [
      'Prawn broccoli konjac bowl',
      'Prawn courgette cabbage bowl',
      'Tilapia pumpkin bowl',
      'Tilapia squash bowl',
    ]) {
      const recipe = library.recipes.find((row) => row.name === name)!;
      const text = recipe.steps.map((step) => step.text).join(' ');
      expect(text).toContain('pack');
      expect(text).toContain('frozen');
      expect(text).toContain('75°C for 30 seconds');
      expect(recipe.cookMinutes).toBeGreaterThan(0);
    }
  });
});
