import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { foodFixture, foodTime } from '../tests/food-fixture';
import { fixture } from '../tests/fixtures';
import { serialise } from '../src/lib/backup';
const pixel =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCUcAAAAASUVORK5CYII=';
const base = process.env.TEST_SUBPATH || '/';
const date = '2026-10-17';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-17T12:00:00Z'));
});
async function route(page: Page, route: string) {
  await page.goto(base + '#/' + route);
  await expect(page.locator('main h1')).toBeVisible();
}
async function seed(page: Page, stock = 1000, withImage = false) {
  const food = foodFixture();
  if (withImage) {
    food.foodFiles = [
      {
        id: 'food-photo',
        name: 'recipe.png',
        mime: 'image/png',
        data: 'data:image/png;base64,' + pixel,
        createdAt: foodTime,
      },
    ];
    food.recipes[0].imageId = 'food-photo';
  }
  if (stock)
    food.stock = [
      {
        id: 'pack',
        ingredientId: 'rice',
        quantity: stock,
        originalQuantity: stock,
        unit: 'g',
        price: 4,
        location: 'Cupboard',
        expiryKind: 'best-before',
        confidence: 'confirmed',
        notes: 'Test kitchen package',
        brand: '',
        createdAt: foodTime,
      },
    ];
  await route(page, 'settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'food-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise({ ...fixture(), food })),
  });
  const dialog = page.getByRole('dialog', { name: 'Review your backup' });
  await expect(dialog).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm merge import' }).click();
  await expect(dialog).not.toBeVisible();
  return food;
}
async function createIngredient(page: Page) {
  await route(page, 'food-ingredients');
  await page.getByRole('button', { name: 'Add ingredient', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add ingredient', exact: true });
  await dialog.getByLabel('Ingredient name', { exact: true }).fill('Oats');
  await dialog.getByLabel('Protein (g)', { exact: true }).fill('12');
  await dialog.getByLabel('Carbohydrates (g)', { exact: true }).fill('60');
  await dialog.getByLabel('Fat (g)', { exact: true }).fill('7');
  await dialog.getByLabel('Fibre (g)', { exact: true }).fill('10');
  await dialog.getByLabel('Nutrition status').selectOption('manual');
  await dialog.getByRole('button', { name: 'Save ingredient', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
test('ingredients, durable recipe drafts, scaling, filters and diary targets work from real forms', async ({
  page,
}) => {
  await createIngredient(page);
  await route(page, 'food-menu');
  await page.getByRole('button', { name: 'Create recipe', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Create recipe', exact: true });
  await dialog.getByLabel('Recipe name', { exact: true }).fill('Morning oats');
  await dialog.getByLabel('Recipe servings', { exact: true }).fill('2');
  await dialog.getByRole('button', { name: 'Add recipe ingredient', exact: true }).click();
  await dialog.getByLabel('Quantity 1', { exact: true }).fill('200');
  await expect(page.locator('.save-status')).toHaveText('On-device storage');
  await page.reload();
  await page.getByRole('button', { name: 'Create recipe', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Create recipe', exact: true });
  await expect(dialog.getByLabel('Recipe name', { exact: true })).toHaveValue('Morning oats');
  await expect(dialog.getByLabel('Quantity 1', { exact: true })).toHaveValue('200');
  await dialog.getByRole('button', { name: 'Add cooking step', exact: true }).click();
  await dialog
    .getByLabel('Instruction 1', { exact: true })
    .fill('Prepare using the packet instructions.');
  await dialog.getByRole('button', { name: 'Save recipe', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator('.recipe-card').filter({ hasText: 'Morning oats' });
  await expect(card).toContainText('12');
  await card.getByRole('button', { name: 'View recipe', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Morning oats', exact: true });
  await dialog.getByLabel('Scale to servings').fill('4');
  await expect(dialog).toContainText('48');
  await dialog.getByRole('button', { name: 'Log a serving', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Log food', exact: true });
  await dialog.getByLabel('Servings eaten').fill('1.5');
  await dialog.getByRole('button', { name: 'Save food entry', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.food-diary-entry')).toContainText('Morning oats');
  await expect(page.locator('.food-diary-entry')).toContainText('18');
  await page.getByRole('button', { name: 'Set macro targets' }).click();
  dialog = page.getByRole('dialog', { name: 'Macro targets' });
  await dialog.getByLabel('Protein target enabled', { exact: true }).check();
  await dialog.getByLabel('Protein daily target (g)', { exact: true }).fill('120');
  await dialog.getByRole('button', { name: 'Save targets' }).click();
  await expect(page.getByText('Protein: 18 / 120 g')).toBeVisible();
  await page.reload();
  await expect(page.locator('.food-diary-entry')).toContainText('Morning oats');
  await route(page, 'food-kitchen');
  await expect(page.getByText('No stock matches this view.')).toBeVisible(); // Viewing/scaling/logging a recipe alone does not cook it.
});
test('menu cards upload, replace and persist photos; the editor previews and removes them', async ({
  page,
}) => {
  await seed(page);
  await route(page, 'food-menu');
  const card = page
    .locator('.recipe-card')
    .filter({ has: page.getByRole('heading', { name: 'Rice bowl', exact: true }) });
  const choose = page.waitForEvent('filechooser');
  await card.getByRole('button', { name: 'Add photo to Rice bowl', exact: true }).click();
  await (
    await choose
  ).setFiles({ name: 'meal.png', mimeType: 'image/png', buffer: Buffer.from(pixel, 'base64') });
  await expect(card.locator('img')).toHaveAttribute('src', 'data:image/png;base64,' + pixel);
  await expect(card.locator('img')).toHaveJSProperty('naturalWidth', 1);
  await page.reload();
  await expect(
    card.getByRole('button', { name: 'Change photo for Rice bowl', exact: true }),
  ).toBeVisible();
  await expect(card.locator('img')).toHaveAttribute('src', 'data:image/png;base64,' + pixel);
  await card.getByRole('button', { name: 'Edit Rice bowl', exact: true }).click();
  let editor = page.getByRole('dialog', { name: 'Edit recipe', exact: true });
  await expect(editor.getByAltText('Recipe preview', { exact: true })).toBeVisible();
  await editor.getByLabel('Personal notes', { exact: true }).fill('An unfinished recipe note');
  await expect(page.locator('.save-status')).toHaveText('On-device storage');
  await editor.getByRole('button', { name: 'Close editor', exact: true }).click();
  const replacement = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 160;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#597e69';
    context.fillRect(0, 0, 240, 160);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  });
  await card.getByLabel('Upload photo for Rice bowl', { exact: true }).setInputFiles({
    name: 'meal.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(replacement, 'base64'),
  });
  await expect(card.locator('img')).toHaveAttribute('src', 'data:image/jpeg;base64,' + replacement);
  await card.getByLabel('Upload photo for Rice bowl', { exact: true }).setInputFiles({
    name: 'unsupported.heic',
    mimeType: 'image/heic',
    buffer: Buffer.from('unsupported'),
  });
  await expect(page.getByText('Choose a PNG, JPEG or WebP image.', { exact: true })).toBeVisible();
  await expect(card.locator('img')).toHaveAttribute('src', 'data:image/jpeg;base64,' + replacement);
  await card.getByLabel('Upload photo for Rice bowl', { exact: true }).setInputFiles({
    name: 'too-large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByText('Images must be below 5 MB. Resize the image and try again.', { exact: true }),
  ).toBeVisible();
  await card.getByRole('button', { name: 'Edit Rice bowl', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Edit recipe', exact: true });
  await expect(editor.getByLabel('Personal notes', { exact: true })).toHaveValue(
    'An unfinished recipe note',
  );
  await expect(editor.getByAltText('Recipe preview', { exact: true })).toHaveAttribute(
    'src',
    'data:image/jpeg;base64,' + replacement,
  );
  await editor.getByRole('button', { name: 'Save recipe', exact: true }).click();
  await card.getByRole('button', { name: 'View recipe', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Rice bowl', exact: true });
  await expect(details.locator('.food-detail-image')).toHaveAttribute(
    'src',
    'data:image/jpeg;base64,' + replacement,
  );
  await details.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await card.getByRole('button', { name: 'Edit Rice bowl', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Edit recipe', exact: true });
  await editor.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(editor.getByAltText('Recipe preview', { exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Save recipe', exact: true }).click();
  await expect(card.locator('img')).toHaveCount(0);
  await page.reload();
  await expect(
    card.getByRole('button', { name: 'Add photo to Rice bowl', exact: true }),
  ).toBeVisible();
});
test('cooking consumes stock once and prepared portions survive reload, correction and waste', async ({
  page,
}) => {
  await seed(page);
  await route(page, 'food-kitchen');
  await page.getByLabel('Recipe to prepare').selectOption('rice-meal');
  await page.getByRole('button', { name: 'I cooked this recipe', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Confirm cooking · Rice bowl' });
  await dialog.getByRole('button', { name: 'Confirm cooking & deduct stock', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.food-stock-quantity')).toContainText('100');
  await expect(page.getByText('3 / 3 portions')).toBeVisible();
  await page.getByRole('button', { name: 'Eat a portion', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Log food', exact: true });
  await dialog.getByRole('button', { name: 'Save food entry', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await route(page, 'food-kitchen');
  await expect(page.getByText('2 / 3 portions')).toBeVisible();
  await page.reload();
  await expect(page.getByText('2 / 3 portions')).toBeVisible();
  await page.getByRole('button', { name: 'Discard portions', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Record food waste' });
  await dialog.getByLabel('Amount discarded (portions)').fill('0.5');
  await dialog.getByLabel('Reason / waste notes').fill('Spilled portion');
  await dialog.getByRole('button', { name: 'Confirm discarded food' }).click();
  await expect(page.getByText('1.5 / 3 portions')).toBeVisible();
  await route(page, 'food-budget');
  await expect(page.getByText('Spilled portion')).toBeVisible();
});
test('meal plan shopping subtracts stock, rounds packages and keeps manual additions after plan edits', async ({
  page,
}) => {
  await seed(page, 350);
  await route(page, 'food-planner');
  await page.getByRole('button', { name: 'Plan a meal', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Plan a meal', exact: true });
  await dialog.getByLabel('Planned recipe').selectOption('rice-meal');
  await dialog.getByLabel('Planned servings').fill('3');
  await dialog.getByRole('button', { name: 'Save planned meal', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Shop this week', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Shopping & purchases');
  await expect(page.getByText(/Shortage 550 g/)).toBeVisible();
  await expect(page.getByText(/1,000 g/)).toBeVisible();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Add shopping item' });
  await dialog.getByLabel('Shopping item name').fill('Tea towels');
  await dialog.getByRole('button', { name: 'Save shopping item' }).click();
  await expect(dialog).toHaveCount(0);
  await route(page, 'food-planner');
  await page.getByRole('button', { name: /Edit plan Rice bowl/ }).click();
  dialog = page.getByRole('dialog', { name: 'Edit planned meal' });
  await dialog.getByLabel('Planned servings').fill('6');
  await dialog.getByRole('button', { name: 'Save planned meal' }).click();
  await expect(dialog).toHaveCount(0);
  await route(page, 'food-shopping');
  await expect(page.getByText('Tea towels', { exact: true })).toBeVisible();
  await expect(page.getByText(/Shortage 1,450 g/)).toBeVisible();
  await route(page, 'food-kitchen');
  await expect(page.locator('.food-stock-quantity')).toContainText('350');
});
test('local OCR recognises a real image, requires review and matching, and never makes external requests', async ({
  page,
}) => {
  test.setTimeout(120000);
  await seed(page, 0);
  await route(page, 'food-shopping');
  const external: string[] = [];
  page.on('request', (req) => {
    if (
      !req.url().startsWith(new URL(page.url()).origin) &&
      !req.url().startsWith('data:') &&
      !req.url().startsWith('blob:')
    )
      external.push(req.url());
  });
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 900, 600);
    ctx.fillStyle = 'black';
    ctx.font = '32px monospace';
    [
      'TEST MARKET',
      '17/10/2026',
      'RICE 500g      2.00',
      'MILK 1l       1.50',
      'TOTAL         3.50',
    ].forEach((line, i) => ctx.fillText(line, 60, 80 + i * 80));
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'Record purchase / receipt', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Record purchase / receipt', exact: true });
  await dialog.getByLabel('Upload receipt image', { exact: true }).setInputFiles({
    name: 'synthetic-receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from(image, 'base64'),
  });
  await expect(dialog.locator('.receipt-image')).toBeVisible();
  await dialog.getByRole('button', { name: 'Read receipt text', exact: true }).click();
  await expect(dialog.getByLabel('Receipt text (editable)')).toHaveValue(/RICE/i, {
    timeout: 90000,
  });
  await expect(page.locator('.save-status')).toHaveText('On-device storage');
  await page.reload();
  await page.getByRole('button', { name: 'Record purchase / receipt', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Record purchase / receipt', exact: true });
  await expect(dialog.getByLabel('Receipt text (editable)')).toHaveValue(/RICE/i);
  await expect(dialog.locator('.receipt-image')).toBeVisible();
  await dialog.getByRole('button', { name: 'Extract draft purchase lines' }).click();
  await expect(dialog.getByLabel('Total paid at checkout')).toHaveValue('3.5');
  await expect(dialog.getByRole('button', { name: 'Save reviewed purchase' })).toBeDisabled();
  await dialog.getByLabel('Match ingredient 1', { exact: true }).selectOption('rice');
  await dialog.getByLabel('Match ingredient 2', { exact: true }).selectOption('milk');
  await dialog.getByLabel('Package quantity 1', { exact: true }).fill('500');
  await dialog.getByLabel('Package unit 1', { exact: true }).selectOption('g');
  await dialog.getByLabel('Package quantity 2', { exact: true }).fill('1');
  await dialog.getByLabel('Package unit 2', { exact: true }).selectOption('l');
  await dialog
    .getByLabel('I have reviewed the date, product lines, quantities and prices.')
    .check();
  await dialog.getByRole('button', { name: 'Save reviewed purchase' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Not received', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Receive purchase into kitchen' }).click();
  await expect(page.getByRole('button', { name: 'Receive purchase into kitchen' })).toBeDisabled();
  await route(page, 'food-kitchen');
  await expect(page.locator('.food-stock-quantity')).toHaveCount(2);
  expect(external).toEqual([]);
});
test('complete and category exports preserve food records and images with safe import previews', async ({
  page,
  browser,
}) => {
  await seed(page, 1000, true);
  await route(page, 'settings');
  let event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export everything', exact: true }).click();
  let file = await event;
  const backup = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(backup.schemaVersion).toBe(5);
  expect(backup.data.food.recipes).toHaveLength(1);
  expect(backup.data.food.foodFiles).toHaveLength(1);
  expect(backup.manifest.attachments).toBe(1);
  expect(backup.data.sessions.every((s: object) => !('calories' in s))).toBe(true);
  expect(backup.data.food.foodSettings.showCalories).toBe(false);
  event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected categories', exact: true }).click();
  file = await event;
  const categories = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(categories.scope).toBe('categories');
  expect(categories.data.sessions).toEqual([]);
  expect(categories.data.food.recipes).toHaveLength(1);
  expect(categories.data.food.foodFiles).toEqual(backup.data.food.foodFiles);
  await page.getByLabel('Import selected categories', { exact: true }).setInputFiles({
    name: 'categories.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(categories)),
  });
  const dialog = page.getByRole('dialog', { name: 'Review your backup' });
  await expect(dialog).toContainText('Selected categories with dependencies');
  await expect(
    dialog.getByRole('option', { name: 'Replace · use records from this file' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await route(page, 'food-menu');
  await expect(page.getByRole('heading', { name: 'Rice bowl', exact: true })).toBeVisible();
  const restoredContext = await browser.newContext();
  try {
    const restoredPage = await restoredContext.newPage();
    await route(restoredPage, 'settings');
    await restoredPage.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
      name: 'complete.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    const preview = restoredPage.getByRole('dialog', { name: 'Review your backup' });
    await preview.getByLabel('Import method').selectOption('replace');
    restoredPage.once('dialog', (d) => d.accept());
    await preview.getByRole('button', { name: 'Confirm replace import' }).click();
    await expect(preview).toHaveCount(0);
    await route(restoredPage, 'food-menu');
    await expect(restoredPage.locator('.recipe-card img')).toHaveAttribute(
      'src',
      'data:image/png;base64,' + pixel,
    );
    await restoredPage.reload();
    await expect(
      restoredPage.getByRole('heading', { name: 'Rice bowl', exact: true }),
    ).toBeVisible();
    await route(restoredPage, 'history');
    await expect(restoredPage.locator('main')).toContainText('Upper session');
  } finally {
    await restoredContext.close();
  }
});
test('food records, images and manual purchases remain usable offline after the app is cached', async ({
  page,
  context,
}) => {
  await seed(page, 1000, true);
  await route(page, 'food-menu');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.recipe-card img')).toHaveAttribute(
    'src',
    'data:image/png;base64,' + pixel,
  );
  await route(page, 'food-shopping');
  await page.getByRole('button', { name: 'Record purchase / receipt', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record purchase / receipt', exact: true });
  await dialog.getByLabel('Retailer', { exact: true }).fill('Offline market');
  await dialog.getByLabel('Total paid at checkout').fill('2');
  await dialog
    .getByLabel('I have reviewed the date, product lines, quantities and prices.')
    .check();
  await dialog.getByLabel(/I have reviewed and accept this difference/).check();
  await dialog.getByRole('button', { name: 'Save reviewed purchase' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Purchase history', exact: true }).click();
  await expect(page.getByText('Offline market', { exact: true })).toBeVisible();
  await route(page, 'food-kitchen');
  await expect(page.locator('.food-stock-quantity')).toContainText('1,000');
});
test.describe('receipt recognition fallback', () => {
  test.use({ serviceWorkers: 'block' });
  test('OCR cancellation and failure leave manual purchase entry available', async ({ page }) => {
    await seed(page, 0);
    await route(page, 'food-shopping');
    await page.getByRole('button', { name: 'Record purchase / receipt', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Record purchase / receipt', exact: true });
    await dialog.getByLabel('Upload receipt image', { exact: true }).setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pixel, 'base64'),
    });
    await expect(dialog.locator('.receipt-image')).toBeVisible();
    await page.route('**/ocr/tesseract.esm.min.js', async (request) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await request.abort();
    });
    await dialog.getByRole('button', { name: 'Read receipt text', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel recognition', exact: true }).click();
    await expect(page.locator('.save-status')).toHaveText('On-device storage');
    await dialog.getByLabel('Retailer', { exact: true }).fill('Manual fallback');
    await dialog
      .getByLabel('I have reviewed the date, product lines, quantities and prices.')
      .check();
    await expect(dialog.getByRole('button', { name: 'Save reviewed purchase' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Read receipt text', exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: 'Cancel recognition', exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('.save-status')).toHaveText('On-device storage');
    await expect(dialog.getByRole('button', { name: 'Save reviewed purchase' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Save reviewed purchase' }).click();
    await expect(dialog).toHaveCount(0);
  });
});
test('recipe substitutions recalculate, save separately and keep scaled cooking explicit', async ({
  page,
}, testInfo) => {
  await seed(page);
  await route(page, 'food-menu');
  await page
    .locator('.recipe-card')
    .getByRole('button', { name: 'View recipe', exact: true })
    .click();
  let dialog = page.getByRole('dialog', { name: 'Rice bowl', exact: true });
  await dialog.getByLabel('Scale to servings').fill('2');
  await dialog.getByRole('button', { name: 'I cooked this', exact: true }).click();
  const cook = page.getByRole('dialog', { name: 'Confirm cooking · Rice bowl' });
  await expect(cook.getByLabel('Portions prepared')).toHaveValue('2');
  await cook.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await dialog.getByLabel('Substitute ingredient 1', { exact: true }).selectOption('milk');
  await dialog
    .getByLabel('Substitution quantity 1 (whole original recipe)', { exact: true })
    .fill('100');
  await expect(dialog.getByRole('button', { name: 'Log a serving', exact: true })).toBeDisabled();
  await expect(dialog).toContainText('Recipe changed');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({
    path: '.local/food-qa/' + testInfo.project.name + '-recipe.png',
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Save variation as a new recipe' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.recipe-card')).toHaveCount(2);
  await page.screenshot({
    path: '.local/food-qa/' + testInfo.project.name + '-menu.png',
    fullPage: true,
  });
});
test('food screens support narrow layouts, themes, keyboard controls and accessible empty states', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page);
  const violations: unknown[] = [];
  for (const theme of ['light', 'dark'])
    for (const path of [
      'food-menu',
      'food-ingredients',
      'food-diary',
      'food-kitchen',
      'food-planner',
      'food-shopping',
      'food-budget',
    ]) {
      await route(page, path);
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.getByRole('button', { name: 'Toggle colour theme' }).click();
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      violations.push(
        ...axe.violations.map((v) => ({
          path,
          theme,
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      );
      expect(await page.locator('body').innerText()).not.toMatch(/calorie|kcal/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  await page.setViewportSize({ width: 320, height: 820 });
  for (const path of [
    'food-menu',
    'food-diary',
    'food-kitchen',
    'food-planner',
    'food-shopping',
    'food-budget',
  ]) {
    await route(page, path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});
