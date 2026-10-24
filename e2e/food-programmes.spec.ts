import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { fillingBowlStarter } from '../src/lib/food-programme-starter';
import { serialise } from '../src/lib/backup';
import { fixture } from '../tests/fixtures';
import { foodFixture } from '../tests/food-fixture';
const base = process.env.TEST_SUBPATH || '/';
const today = '2026-10-24';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00Z'));
});
async function route(page: Page, route: string) {
  await page.goto(base + '#/' + route);
  await expect(page.locator('main')).toBeVisible();
}
async function install(page: Page) {
  await route(page, 'food-programmes');
  await page.getByRole('button', { name: 'Review starter programme' }).click();
  const dialog = page.getByRole('dialog', { name: 'Review programme import' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Import programme', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Start programme', exact: true })).toBeVisible();
}
async function activate(page: Page) {
  await page.getByRole('button', { name: 'Start programme', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Start food programme' });
  await expect(dialog.getByText(/90 eligible meals/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Start programme & fill empty slots' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.programme-meal-row')).toHaveCount(3);
}
async function backup(page: Page) {
  await route(page, 'settings');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export everything', exact: true }).click();
  const path = await (await event).path();
  return JSON.parse(await readFile(path!, 'utf8'));
}
test('installs a programme, starts 30 days, records an unmeasured meal once and keeps it through reload/offline and undo', async ({
  page,
  context,
}) => {
  await install(page);
  await activate(page);
  const row = page.locator('.programme-meal-row').first();
  await row.getByRole('button', { name: 'Ate this', exact: true }).click();
  const check = page.getByRole('dialog', { name: 'Record meal eaten' });
  await expect(check.getByLabel('Actual servings eaten')).toHaveCount(0);
  await check.getByLabel('Check-in notes').fill('Comfortably full; no quantities recorded.');
  await check.getByRole('button', { name: 'Save check-in' }).click();
  await expect(check).not.toBeVisible();
  await expect(row.getByText('Checked in · unmeasured')).toBeVisible();
  const file = await backup(page);
  expect(file.data.food.mealPlans).toHaveLength(90);
  expect(file.data.food.foodEntries).toHaveLength(1);
  expect(file.data.food.foodEntries[0].snapshot.macros).toEqual({});
  expect(file.data.food.stock).toEqual([]);
  expect(file.data.food.movements).toEqual([]);
  expect(file.data.food.foodSettings.showCalories).toBe(false);
  await route(page, 'food-diary?date=' + today);
  await expect(page.getByText('Comfortably full; no quantities recorded.')).toBeVisible();
  await expect(page.getByText('Unmeasured meal', { exact: true })).toBeVisible();
  await route(page, 'food-programmes');
  await page.reload();
  await expect(
    page.locator('.programme-meal-row').first().getByText('Checked in · unmeasured'),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.programme-meal-row')).toHaveCount(3);
  await page
    .locator('.programme-meal-row')
    .first()
    .getByRole('button', { name: /^Undo / })
    .click();
  await expect(
    page
      .locator('.programme-meal-row')
      .first()
      .getByRole('button', { name: 'Ate this', exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});
test('swaps persist, re-planning does not duplicate and pausing retains plans', async ({
  page,
}) => {
  await install(page);
  await activate(page);
  const first = page.locator('.programme-meal-row').first();
  const before = await first.locator('h3').innerText();
  await first.getByRole('button', { name: /^Swap / }).click();
  const swap = page.getByRole('dialog', { name: 'Swap planned meal' });
  const choice = swap.getByLabel('Swap meal');
  const options = await choice
    .locator('option')
    .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
  await choice.selectOption(options[1]);
  await swap.getByRole('button', { name: 'Save swap' }).click();
  await expect(swap).not.toBeVisible();
  await expect(first.locator('h3')).not.toHaveText(before);
  const after = await first.locator('h3').innerText();
  await page.getByText('My schedules (1)', { exact: true }).click();
  await page.getByRole('button', { name: 'Plan this week', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Plan this week', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.locator('.programme-meal-row').first().locator('h3')).toHaveText(after);
  await page.getByText('My schedules (1)', { exact: true }).click();
  await page.getByRole('button', { name: 'Pause programme', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume programme', exact: true })).toBeVisible();
  expect((await backup(page)).data.food.mealPlans).toHaveLength(90);
});
test('builds a bowl without quantities and creates a custom programme with it', async ({
  page,
}) => {
  await install(page);
  await page.getByRole('button', { name: 'Build a bowl', exact: true }).click();
  const bowl = page.getByRole('dialog', { name: 'Build a bowl', exact: true });
  await bowl.getByLabel('Meal name', { exact: true }).fill('My cucumber chicken bowl');
  await bowl.getByLabel('Add protein', { exact: true }).selectOption({ label: 'Chicken breast' });
  await bowl
    .getByLabel('Add fruit, vegetables & volume', { exact: true })
    .selectOption({ label: 'Cucumber' });
  await bowl.getByLabel('Add fat choice', { exact: true }).selectOption({ label: 'Avocado' });
  await bowl.getByRole('button', { name: 'Save bowl', exact: true }).click();
  await expect(bowl).not.toBeVisible();
  await page.getByRole('button', { name: 'Create programme', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Create food programme' });
  await editor.getByLabel('Programme name').fill('My flexible food programme');
  await editor.getByLabel('Repeat cycle (days)').fill('1');
  await editor
    .getByLabel('Day 1 Breakfast', { exact: true })
    .selectOption({ label: 'My cucumber chicken bowl' });
  await editor.getByRole('button', { name: 'Save programme', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'My flexible food programme' })).toBeVisible();
  const data = (await backup(page)).data.food;
  const recipe = data.recipes.find((r: { name: string }) => r.name === 'My cucumber chicken bowl');
  expect(recipe.unmeasured).toBe(true);
  expect(recipe.ingredients).toEqual([]);
  expect(recipe.composition).toHaveLength(3);
});
test('shares only reusable content and reuses an unchanged programme import', async ({ page }) => {
  await install(page);
  await activate(page);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share programme', exact: true }).click();
  const path = await (await event).path();
  const text = await readFile(path!, 'utf8');
  const file = JSON.parse(text);
  expect(file.type).toBe('food-programme-library');
  expect(file.programmes).toHaveLength(1);
  expect(file).not.toHaveProperty('foodSchedules');
  expect(file).not.toHaveProperty('foodEntries');
  expect(file).not.toHaveProperty('foodSettings');
  await page.getByLabel('Import programme', { exact: true }).setInputFiles({
    name: 'programme.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  const dialog = page.getByRole('dialog', { name: 'Review programme import' });
  await expect(dialog.getByText('foodProgrammes: 0 new · 1 reused · 0 conflicting')).toBeVisible();
  await dialog.getByRole('button', { name: 'Import programme', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await backup(page)).data.food.foodProgrammes).toHaveLength(1);
});
test('offers a schema-based prompt and rejects an invalid library without writes', async ({
  page,
}) => {
  await route(page, 'food-programmes');
  await page.getByRole('button', { name: 'Get prompt', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Get import prompt' });
  await expect(dialog.getByLabel('Import prompt', { exact: true })).toHaveValue(
    /food-programme-library/,
  );
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  const file = fillingBowlStarter();
  file.programmes[0].rotation[0].recipeIds = ['missing'];
  await page.getByLabel('Import programme', { exact: true }).setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByRole('alert')).toContainText('missing meal');
  expect((await backup(page)).data.food.foodProgrammes).toEqual([]);
});
test('keeps an existing manual meal when activating and can confirm a quantified actual portion', async ({
  page,
}) => {
  await route(page, 'settings');
  const food = foodFixture();
  food.mealPlans = [
    {
      id: 'manual-plan',
      date: today,
      slot: 'Breakfast',
      recipeId: food.recipes[0].id,
      servings: 1,
      notes: 'Existing manual meal',
      createdAt: '2026-10-24T10:00:00Z',
    },
  ];
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise({ ...fixture(), food })),
  });
  const restore = page.getByRole('dialog', { name: 'Review your backup' });
  page.once('dialog', (d) => d.accept());
  await restore.getByRole('button', { name: 'Confirm merge import' }).click();
  await expect(restore).not.toBeVisible();
  await install(page);
  await page.getByRole('button', { name: 'Start programme', exact: true }).click();
  const start = page.getByRole('dialog', { name: 'Start food programme' });
  await expect(start.getByText(/1 occupied slots kept/)).toBeVisible();
  await start.getByRole('button', { name: 'Start programme & fill empty slots' }).click();
  await expect(start).not.toBeVisible();
  await expect(page.locator('.programme-meal-row')).toHaveCount(2);
  await page
    .locator('.programme-meal-row')
    .first()
    .getByRole('button', { name: 'Ate this', exact: true })
    .click();
  const check = page.getByRole('dialog', { name: 'Record meal eaten' });
  await check.getByLabel('Meal actually eaten').selectOption({ label: 'Rice bowl' });
  await check.getByLabel('I confirm the recipe and portion eaten').check();
  await check.getByLabel('Actual servings eaten').fill('2');
  await check.getByRole('button', { name: 'Save check-in' }).click();
  await expect(check).not.toBeVisible();
  const data = (await backup(page)).data.food;
  expect(data.mealPlans.find((p: { id: string }) => p.id === 'manual-plan').notes).toBe(
    'Existing manual meal',
  );
  expect(data.foodEntries).toHaveLength(1);
  expect(data.foodEntries[0].unmeasured).toBe(false);
  expect(data.foodEntries[0].servings).toBe(2);
});
test('programme widget is usable in narrow layouts and programme page passes accessibility', async ({
  page,
}, testInfo) => {
  await install(page);
  await activate(page);
  await route(page, 'food-home');
  // New default Food layouts include the widget; existing customised pages are preserved.
  await expect(page.locator('.programme-day').first()).toBeVisible();
  if (testInfo.project.name === 'desktop') await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page
      .locator('.programme-day')
      .first()
      .getByRole('button', { name: 'Ate this', exact: true })
      .first(),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await route(page, 'food-programmes');
  const results = await new AxeBuilder({ page }).include('main').analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `.local/food-programme-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('shopping keeps unmeasured ingredients as a checklist and preserves ticks on regeneration', async ({
  page,
}) => {
  await install(page);
  await activate(page);
  await route(page, 'food-shopping');
  await page.getByRole('button', { name: 'Generate from this week’s plan', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Unmeasured ingredients — review quantities' }),
  ).toBeVisible();
  const tick = page.locator('main .check-label input[type=checkbox]').first();
  await tick.click();
  await expect(tick).toBeChecked();
  await page.getByRole('button', { name: 'Regenerate requirements', exact: true }).click();
  await expect(tick).toBeChecked();
  await page.reload();
  await expect(tick).toBeChecked();
  const food = (await backup(page)).data.food;
  expect(food.shoppingLists[0].items).toEqual([]);
  expect(food.shoppingLists[0].checklist.some((r: { checked: boolean }) => r.checked)).toBe(true);
  expect(food.stock).toEqual([]);
});

test('unfinished bowls survive reload, with calorie visibility and system controls preserving programme data', async ({
  page,
}) => {
  await install(page);
  await activate(page);
  await page.getByRole('button', { name: 'Build a bowl', exact: true }).click();
  let bowl = page.getByRole('dialog', { name: 'Build a bowl', exact: true });
  await bowl.getByLabel('Meal name', { exact: true }).fill('Recover my draft');
  await bowl.getByLabel('Add protein', { exact: true }).selectOption({ label: 'Chicken breast' });
  await expect(page.getByRole('button', { name: 'Save bowl', exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Build a bowl', exact: true }).click();
  bowl = page.getByRole('dialog', { name: 'Build a bowl', exact: true });
  await expect(bowl.getByLabel('Meal name', { exact: true })).toHaveValue('Recover my draft');
  await expect(bowl.getByText('Chicken breast', { exact: true }).first()).toBeVisible();
  await bowl.getByRole('button', { name: 'Close dialog' }).click();
  await route(page, 'food-home');
  await page.getByText('Food display', { exact: true }).click();
  await page.getByRole('switch', { name: 'Show calories', exact: true }).check();
  await expect(page.getByText('Estimated calories', { exact: true }).first()).toBeVisible();
  await page.getByRole('switch', { name: 'Show calories', exact: true }).uncheck();
  await expect(page.getByText('Estimated calories', { exact: true })).toHaveCount(0);
  await route(page, 'settings');
  await page.getByRole('switch', { name: 'Enable Food system' }).uncheck();
  await route(page, 'food-programmes');
  await expect(
    page.getByRole('heading', { name: 'Food is switched off', exact: true }),
  ).toBeVisible();
  await route(page, 'settings');
  await page.getByRole('switch', { name: 'Enable Food system' }).check();
  await route(page, 'food-programmes');
  await expect(page.locator('.programme-meal-row')).toHaveCount(3);
  const food = (await backup(page)).data.food;
  expect(food.foodSchedules).toHaveLength(1);
  expect(food.mealPlans).toHaveLength(90);
  expect(food.foodSettings.showCalories).toBe(false);
});

test('programme widget can be added to a personal page with its own date and half width', async ({
  page,
}) => {
  await install(page);
  await activate(page);
  await route(page, 'food-home');
  await page.getByRole('button', { name: 'My pages', exact: true }).click();
  await page.getByRole('button', { name: 'Create page', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Create page', exact: true });
  await dialog.getByLabel('Page name', { exact: true }).fill('My food desk');
  await dialog.getByRole('button', { name: 'Save page', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Edit page', exact: true }).click();
  await page.getByRole('button', { name: 'Add widget', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Find a widget').fill('Food programme');
  await page.getByRole('button', { name: 'Add Food programme', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Configure widget', exact: true });
  await dialog.getByLabel('Widget size', { exact: true }).selectOption('half');
  await dialog.getByText('Appearance & phone layout', { exact: true }).click();
  await dialog.getByLabel('Phone widget width', { exact: true }).selectOption('half');
  await dialog.getByLabel('Specific date (blank follows today)').fill('2026-10-25');
  await dialog.getByRole('button', { name: 'Save widget', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  const widget = page.locator('.workspace-widget').first();
  await expect(widget).toHaveClass(/widget-size-half/);
  await expect(widget.locator('.programme-meal-row')).toHaveCount(3);
  await expect(widget.getByText('2026-10-25', { exact: true })).toBeVisible();
  await page.reload();
  await expect(widget.locator('.programme-meal-row')).toHaveCount(3);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await widget.screenshot({ path: `.local/food-programme-half-${test.info().project.name}.png` });
});

test('a friend can import a shared programme into an empty profile without receiving the sender’s schedule', async ({
  page,
  browser,
}) => {
  await install(page);
  await activate(page);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share programme', exact: true }).click();
  const file = await readFile((await (await downloadEvent).path())!, 'utf8');
  const friendContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const friend = await friendContext.newPage();
    await route(friend, 'food-programmes');
    await friend.getByLabel('Import programme', { exact: true }).setInputFiles({
      name: 'friend.json',
      mimeType: 'application/json',
      buffer: Buffer.from(file),
    });
    const review = friend.getByRole('dialog', { name: 'Review programme import' });
    await review.getByRole('button', { name: 'Import programme', exact: true }).click();
    await expect(review).not.toBeVisible();
    await expect(
      friend.getByRole('button', { name: 'Start programme', exact: true }),
    ).toBeVisible();
    const data = (await backup(friend)).data.food;
    expect(data.foodProgrammes).toHaveLength(1);
    expect(data.foodSchedules).toEqual([]);
    expect(data.mealPlans).toEqual([]);
    expect(data.foodEntries).toEqual([]);
    expect(data.foodSettings.showCalories).toBe(false);
  } finally {
    await friendContext.close();
  }
});

test('menu searches bowl ingredients and keeps unknown preparation times out of timed filters', async ({
  page,
}) => {
  await install(page);
  await page.getByRole('button', { name: 'Build a bowl', exact: true }).click();
  const bowl = page.getByRole('dialog', { name: 'Build a bowl', exact: true });
  await bowl.getByLabel('Meal name', { exact: true }).fill('Konjac bowl with no recorded time');
  await bowl
    .getByLabel('Add fruit, vegetables & volume', { exact: true })
    .selectOption({ label: 'Konjac noodles' });
  await bowl.getByRole('button', { name: 'Save bowl', exact: true }).click();
  await expect(bowl).not.toBeVisible();
  await route(page, 'food-menu');
  await page.getByLabel('Search meals or ingredients', { exact: true }).fill('Konjac');
  await expect(page.locator('.recipe-card')).toHaveCount(3);
  await expect(
    page
      .locator('.recipe-card')
      .filter({ hasText: 'Konjac bowl with no recorded time' })
      .getByText('Time unrecorded', { exact: false }),
  ).toBeVisible();
  await page.getByText('Macro, time, cost & kitchen filters', { exact: true }).click();
  await page.getByLabel('Maximum time (minutes)', { exact: true }).fill('15');
  await expect(page.locator('.recipe-card')).toHaveCount(0);
  await page.getByLabel('Maximum time (minutes)', { exact: true }).fill('');
  await page.getByLabel('Can make one serving from stock', { exact: true }).check();
  await expect(page.locator('.recipe-card')).toHaveCount(0);
});
