import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { fillingBowlStarter } from '../src/lib/food-programme-starter';
import { serialise } from '../src/lib/backup';
import { emptyData } from '../src/lib/model';
import { emptyFood } from '../src/lib/food-model';

const base = process.env.TEST_SUBPATH || '/';
async function backup(page: Page) {
  await page.goto(base + '#/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export everything', exact: true }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00Z'));
});
async function startStarter(page: Page) {
  await page.goto(base + '#/food-programmes');
  await page.getByRole('button', { name: 'Review starter programme', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Import programme', exact: true })
    .click();
  await page.getByRole('button', { name: 'Start programme', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start programme & fill empty slots', exact: true })
    .click();
}
test('a disliked food can be removed after starting, with reviewed alternatives and retained diary history', async ({
  page,
}) => {
  await startStarter(page);
  await page.goto(base + '#/food-home');
  const first = page.locator('.food-home-daily .programme-meal-row').first();
  await first.getByRole('button', { name: 'Ate this', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Check-in notes').fill('Keep this record');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save check-in', exact: true })
    .click();
  await expect(first.getByText('Checked in · unmeasured', { exact: true })).toBeVisible();
  await page.goto(base + '#/food-programmes');
  await page.getByText('My schedules (1)', { exact: true }).click();
  await page.getByRole('button', { name: 'Foods I avoid', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Foods I avoid', exact: true });
  await dialog.getByLabel('Search ingredients', { exact: true }).fill('tuna');
  await dialog.getByRole('checkbox', { name: 'Tuna', exact: true }).check();
  await expect(
    dialog.getByText('Tuna kimchi bowl → Chicken cucumber bowl', { exact: true }).first(),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  await dialog.getByRole('button', { name: 'Save food preferences', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const food = (await backup(page)).data.food;
  expect(food.foodSchedules[0].exclusions).toEqual(['filling-v1-tuna']);
  expect(food.mealPlans).toHaveLength(90);
  expect(
    food.mealPlans.some(
      (plan: { recipeId: string }) => plan.recipeId === 'filling-v1-tuna-kimchi-bowl',
    ),
  ).toBe(false);
  expect(food.foodEntries).toHaveLength(1);
  expect(food.foodEntries[0].notes).toBe('Keep this record');
  await page.goto(base + '#/food-suggest');
  await page.getByLabel('Meal category', { exact: true }).selectOption('Lunch');
  await expect(
    page
      .locator('.meal-suggestion-list')
      .getByRole('heading', { name: 'Tuna kimchi bowl', exact: true }),
  ).toHaveCount(0);
});
test('a stale preferences window cannot clear a food avoidance saved in another tab', async ({
  page,
  context,
}) => {
  await startStarter(page);
  await page.getByText('My schedules (1)', { exact: true }).click();
  await page.getByRole('button', { name: 'Foods I avoid', exact: true }).click();
  const stale = page.getByRole('dialog', { name: 'Foods I avoid', exact: true });
  await stale.getByLabel('Search ingredients', { exact: true }).fill('tuna');
  await expect(stale.getByRole('checkbox', { name: 'Tuna', exact: true })).not.toBeChecked();
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date('2026-10-24T12:00:00Z'));
  await other.goto(base + '#/food-programmes');
  await other.getByText('My schedules (1)', { exact: true }).click();
  await other.getByRole('button', { name: 'Foods I avoid', exact: true }).click();
  const current = other.getByRole('dialog', { name: 'Foods I avoid', exact: true });
  await current.getByLabel('Search ingredients', { exact: true }).fill('tuna');
  await current.getByRole('checkbox', { name: 'Tuna', exact: true }).check();
  await current.getByRole('button', { name: 'Save food preferences', exact: true }).click();
  await expect(current).not.toBeVisible();
  await expect(stale.getByRole('alert')).toHaveText(
    'This programme changed while these preferences were open. Close this window and reopen Foods I avoid to review its latest settings.',
  );
  await expect(
    stale.getByRole('button', { name: 'Save food preferences', exact: true }),
  ).toBeDisabled();
  await stale.getByLabel('Search ingredients', { exact: true }).press('Enter');
  await expect(stale).toBeVisible();
  expect((await backup(other)).data.food.foodSchedules[0].exclusions).toEqual(['filling-v1-tuna']);
  await stale.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Foods I avoid', exact: true }).click();
  const reopened = page.getByRole('dialog', { name: 'Foods I avoid', exact: true });
  await reopened.getByLabel('Search ingredients', { exact: true }).fill('tuna');
  await expect(reopened.getByRole('checkbox', { name: 'Tuna', exact: true })).toBeChecked();
  await expect(
    reopened.getByRole('button', { name: 'Save food preferences', exact: true }),
  ).toBeEnabled();
  await other.close();
});
test('existing original starter content gains cooking guides automatically while a personal method is kept', async ({
  page,
}) => {
  const legacy = fillingBowlStarter(1);
  legacy.recipes[0].steps = [{ id: 'my-method', text: 'My personal breakfast instructions.' }];
  const food = {
    ...structuredClone(emptyFood),
    ingredients: legacy.ingredients,
    recipes: legacy.recipes,
    foodProgrammes: legacy.programmes,
  };
  await page.goto(base + '#/settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'legacy-starter.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise({ ...structuredClone(emptyData), food })),
  });
  const preview = page.getByRole('dialog', { name: 'Review your backup', exact: true });
  page.once('dialog', (dialog) => dialog.accept());
  await preview.getByRole('button', { name: 'Confirm merge import', exact: true }).click();
  await expect(preview).not.toBeVisible();
  await page.goto(base + '#/food-suggest');
  await page.getByLabel('Meal category', { exact: true }).selectOption('Dinner');
  const bowl = page
    .locator('.meal-suggestion-list > section')
    .filter({ has: page.getByRole('heading', { name: 'Chicken courgette bowl', exact: true }) });
  await bowl.getByText('Ingredients & method', { exact: true }).click();
  await expect(bowl.locator('.food-method > li')).toHaveCount(6);
  await expect(bowl.getByText('Courgette', { exact: true })).toBeVisible();
  const updated = (await backup(page)).data.food;
  expect(
    updated.recipes.find((recipe: { id: string }) => recipe.id === legacy.recipes[0].id).steps,
  ).toEqual(legacy.recipes[0].steps);
  expect(updated.foodEntries).toEqual([]);
  expect(updated.mealPlans).toEqual([]);
});
