import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { serialise } from '../src/lib/backup';
import { emptyData } from '../src/lib/model';
import { foodFixture } from '../tests/food-fixture';
import { fillingBowlStarter } from '../src/lib/food-programme-starter';
const base = process.env.TEST_SUBPATH || '/';
test('suggested meals use local recipes and open a reviewed plan while calories stay hidden', async ({
  page,
}) => {
  await page.goto(base + '#/settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'meal-suggestion-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise({ ...structuredClone(emptyData), food: foodFixture() })),
  });
  const preview = page.getByRole('dialog', { name: 'Review your backup' });
  await expect(preview).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await preview.getByRole('button', { name: 'Confirm merge import' }).click();
  await expect(preview).not.toBeVisible();
  await page.goto(base + '#/food-home');
  await expect(page.getByRole('button', { name: 'Suggest a meal', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Suggest a meal', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Suggest a meal', exact: true });
  await expect(dialog.locator('.meal-suggestion-list > section').first()).toBeVisible();
  await expect(dialog.getByText(/kcal|calories/i)).toHaveCount(0);
  await dialog.getByLabel('Meal priority', { exact: true }).selectOption('quick');
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await dialog
    .locator('.meal-suggestion-list > section')
    .first()
    .getByRole('button', { name: /^Plan / })
    .click();
  dialog = page.getByRole('dialog', { name: 'Plan a meal', exact: true });
  await expect(dialog.getByLabel('Planned recipe', { exact: true })).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Save planned meal', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Suggest a meal', exact: true })).toBeVisible();
});
test('empty menu gives a useful empty state', async ({ page }) => {
  await page.goto(base + '#/food-suggest');
  await expect(
    page.getByRole('heading', { name: 'No recipes match this view', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/kcal|calories/i)).toHaveCount(0);
});

test('suggested meals show flexible ingredients and numbered methods, and scale measured ingredients to one serving', async ({
  page,
}) => {
  const food = foodFixture();
  const starter = fillingBowlStarter();
  const chicken = starter.recipes.find((recipe) => recipe.name === 'Chicken courgette bowl')!;
  food.ingredients.push(...starter.ingredients);
  food.recipes.push({
    ...chicken,
    prepMinutes: 8,
    cookMinutes: 15,
    equipment: ['Non-stick frying pan'],
    steps: [
      { id: 'prep', text: 'Slice the courgette and cut the cauliflower into small florets.' },
      { id: 'cook', text: 'Cook the chicken in the pan, then cook the vegetables until tender.' },
      { id: 'serve', text: 'Check the chicken is fully cooked and serve together in the bowl.' },
    ],
    notes: 'The listed olive oil is the cooking oil, rather than an extra dressing.',
  });
  await page.goto(base + '#/settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'recipe-guide-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise({ ...structuredClone(emptyData), food })),
  });
  const preview = page.getByRole('dialog', { name: 'Review your backup' });
  await expect(preview).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await preview.getByRole('button', { name: 'Confirm merge import' }).click();
  await expect(preview).not.toBeVisible();
  await page.goto(base + '#/food-suggest');
  const bowl = page.locator('.meal-suggestion-list > section').filter({
    has: page.getByRole('heading', { name: 'Chicken courgette bowl', exact: true }),
  });
  await bowl.getByText('Ingredients & method', { exact: true }).click();
  const guide = bowl.locator('.meal-recipe-guide');
  await expect(guide.getByRole('heading', { name: 'Ingredients', exact: true })).toBeVisible();
  for (const name of ['Chicken breast', 'Courgette', 'Cauliflower', 'Olive oil'])
    await expect(guide.getByText(name, { exact: true })).toBeVisible();
  await expect(guide.locator('ul > li').filter({ hasText: 'Olive oil' })).toContainText('1 tbsp');
  await expect(guide.getByText(/23 min/)).toBeVisible();
  await expect(guide.getByText(/Non-stick frying pan/)).toBeVisible();
  await expect(guide.getByRole('heading', { name: 'Method', exact: true })).toBeVisible();
  await expect(guide.locator('ol > li')).toHaveCount(3);
  await expect(guide.getByText(/listed olive oil is the cooking oil/)).toBeVisible();
  const rice = page.locator('.meal-suggestion-list > section').filter({
    has: page.getByRole('heading', { name: 'Rice bowl', exact: true }),
  });
  await rice.getByText('Ingredients & method', { exact: true }).click();
  await expect(rice.locator('.meal-recipe-guide').getByText(/Rice · 300 g/)).toBeVisible();
  await expect(rice.getByText('For 1 serving.', { exact: true })).toBeVisible();
  await expect(page.getByText(/kcal|calories/i)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  expect(await guide.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
});
