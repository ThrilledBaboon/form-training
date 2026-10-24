import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { foodFixture } from '../tests/food-fixture';
import { fixture } from '../tests/fixtures';
import { serialise } from '../src/lib/backup';
import { recipeNutrition } from '../src/lib/food-calc';
import { type FoodData } from '../src/lib/food-model';

const base = process.env.TEST_SUBPATH || '/';
const today = '2026-10-24';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00Z'));
});
async function route(page: Page, route: string) {
  await page.goto(base + '#/' + route);
  await expect(page.locator('main h1')).toBeVisible();
}
async function seed(page: Page, food: FoodData) {
  await route(page, 'settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'food-home-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise({ ...fixture(), food })),
  });
  const dialog = page.getByRole('dialog', { name: 'Review your backup' });
  await expect(dialog).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await dialog.getByRole('button', { name: 'Confirm merge import' }).click();
  await expect(dialog).not.toBeVisible();
}
async function backup(page: Page) {
  await route(page, 'settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export everything', exact: true }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}

test('today shows three clear meal slots, plans the selected slot and checks in without quantities', async ({
  page,
}) => {
  await seed(page, foodFixture());
  await route(page, 'food-home');
  await expect(page.getByRole('heading', { name: 'Today’s food', exact: true })).toBeVisible();
  const daily = page.locator('.food-home-daily');
  await expect(daily.locator('.programme-empty-meal h3')).toHaveText([
    'Breakfast',
    'Lunch',
    'Dinner',
  ]);
  await expect(page.getByRole('button', { name: 'Set food goals', exact: true })).toHaveCount(0);
  await expect(page.locator('.food-home-widgets')).not.toHaveAttribute('open');
  await daily.getByRole('button', { name: 'Plan lunch', exact: true }).click();
  const plan = page.getByRole('dialog', { name: 'Plan a meal', exact: true });
  await expect(plan.getByLabel('Planned meal', { exact: true })).toHaveValue('Lunch');
  await plan.getByRole('button', { name: 'Save planned meal', exact: true }).click();
  await expect(plan).not.toBeVisible();
  const lunch = daily.locator('.programme-meal-row').filter({ hasText: 'Rice bowl' });
  await lunch.getByText('View meal', { exact: true }).click();
  await expect(lunch.locator('.programme-composition')).toContainText('Rice');
  await lunch.getByRole('button', { name: 'Ate this', exact: true }).click();
  const checkIn = page.getByRole('dialog', { name: 'Record meal eaten' });
  await expect(checkIn.getByLabel('Check-in meal', { exact: true })).toHaveValue('Lunch');
  await checkIn.getByRole('button', { name: 'Save check-in', exact: true }).click();
  await expect(checkIn).not.toBeVisible();
  await expect(lunch).toContainText('Checked in · unmeasured');
  await page.reload();
  await expect(lunch).toContainText('Checked in · unmeasured');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  const food = (await backup(page)).data.food;
  expect(food.foodSchedules).toEqual([]);
  expect(food.mealPlans).toHaveLength(1);
  expect(food.mealPlans[0].slot).toBe('Lunch');
  expect(food.foodEntries).toHaveLength(1);
  expect(food.foodEntries[0].occurrenceId).toBe(food.mealPlans[0].id);
  expect(food.foodEntries[0].snapshot.macros).toEqual({});
  expect(food.stock).toEqual([]);
});

test('a planned prepared meal deducts portions once, retains its link on edit and returns portions on undo', async ({
  page,
}) => {
  const food = foodFixture();
  food.batches = [
    {
      id: 'prepared-rice',
      recipeId: 'rice-meal',
      name: 'Prepared rice bowl',
      prepared: today,
      location: 'Fridge',
      produced: 3,
      remaining: 3,
      snapshot: recipeNutrition(food, food.recipes[0], 1),
      notes: '',
      createdAt: today + 'T10:00:00Z',
    },
  ];
  food.mealPlans = [
    {
      id: 'prepared-lunch',
      recipeId: 'rice-meal',
      batchId: 'prepared-rice',
      date: today,
      slot: 'Lunch',
      servings: 1,
      notes: '',
      createdAt: today + 'T10:00:00Z',
    },
  ];
  await seed(page, food);
  await route(page, 'food-home');
  const lunch = page
    .locator('.food-home-daily .programme-meal-row')
    .filter({ hasText: 'Rice bowl' });
  await lunch.getByRole('button', { name: 'Ate this', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Log food', exact: true });
  await expect(dialog.getByLabel('Log from', { exact: true })).toHaveValue('batch');
  await expect(dialog.getByLabel('Meal', { exact: true })).toHaveValue('Lunch');
  await dialog.getByRole('button', { name: 'Save food entry', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(lunch).toContainText('Checked in · recorded portion');
  await lunch.getByRole('button', { name: 'Edit check-in', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Edit food entry', exact: true });
  await dialog.getByRole('button', { name: 'Save food entry', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await route(page, 'food-kitchen');
  await expect(page.getByText('2 / 3 portions', { exact: true })).toBeVisible();
  await route(page, 'food-home');
  await page.reload();
  await lunch.getByRole('button', { name: /^Undo / }).click();
  await expect(lunch.getByRole('button', { name: 'Ate this', exact: true })).toBeVisible();
  const restored = (await backup(page)).data.food;
  expect(restored.batches[0].remaining).toBe(3);
  expect(restored.foodEntries).toEqual([]);
  expect(restored.stock).toEqual([]);
});
