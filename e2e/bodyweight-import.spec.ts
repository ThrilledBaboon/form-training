import { test, expect, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
const file = {
  app: 'FORM',
  type: 'bodyweight',
  schemaVersion: 1,
  measurements: [
    { at: '2026-10-19T08:00:00+01:00', kg: 80.25, tags: ['Scale'], notes: 'Original note' },
    { at: '2026-10-19T07:00:00Z', kg: 80.25 },
    { at: '2026-10-18T08:00:00+01:00', kg: 80.5 },
  ],
};
async function upload(input: Locator, value: unknown = file) {
  await input.setInputFiles({
    name: 'weights.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
  });
}

test('bodyweight page provides the schema prompt, previews tags and imports persistently without duplicates', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '#/weight');
  await page.getByRole('button', { name: 'Get prompt', exact: true }).click();
  const prompt = page.getByRole('dialog', { name: 'Get import prompt', exact: true });
  await expect(prompt.getByLabel('Import prompt', { exact: true })).toHaveValue(
    /type:\"bodyweight\"/,
  );
  const download = page.waitForEvent('download');
  await prompt.getByRole('button', { name: 'Download prompt', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('form-bodyweight-prompt.txt');
  await prompt.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Import bodyweight', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import bodyweight', exact: true });
  await upload(dialog.getByLabel('Choose bodyweight JSON', { exact: true }));
  await expect(dialog.getByRole('status')).toHaveText(
    '2 new · 1 duplicates skipped · 0 conflicts skipped',
  );
  await dialog.getByLabel('Additional tags (comma separated)', { exact: true }).fill('Fresh');
  await expect(
    dialog.getByRole('region', { name: 'Measurement preview', exact: true }),
  ).toContainText('Scale, Fresh');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/bodyweight-import-${test.info().project.name}.png` });
  await dialog.getByRole('button', { name: 'Import 2 measurements', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('Bodyweight date range', { exact: true }).selectOption('0');
  await expect(page.locator('.weight-history > div')).toHaveCount(2);
  await expect(page.locator('.weight-history')).toContainText('Original note');
  await page.getByLabel('Weigh-in tag filter', { exact: true }).selectOption('tag:Fresh');
  await page.reload();
  await expect(page.locator('.weight-history > div')).toHaveCount(2);
  await page.getByRole('button', { name: 'Import bodyweight', exact: true }).click();
  await upload(dialog.getByLabel('Choose bodyweight JSON', { exact: true }));
  await expect(dialog.getByRole('status')).toHaveText(
    '0 new · 3 duplicates skipped · 0 conflicts skipped',
  );
  await expect(
    dialog.getByRole('button', { name: 'Import 0 measurements', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.weight-history > div')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('bodyweight import rejects wrong files and previews conflicting readings before any save', async ({
  page,
}) => {
  await page.goto(base + '#/weight');
  await page.getByRole('button', { name: 'Import bodyweight', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import bodyweight', exact: true });
  const input = dialog.getByLabel('Choose bodyweight JSON', { exact: true });
  await upload(input, { ...file, type: 'library' });
  await expect(dialog.getByRole('alert')).toContainText('Choose a FORM bodyweight JSON file');
  await expect(
    dialog.getByRole('button', { name: 'Import 0 measurements', exact: true }),
  ).toBeDisabled();
  await upload(input, {
    ...file,
    measurements: [file.measurements[0], { ...file.measurements[0], kg: 90 }, file.measurements[2]],
  });
  await expect(dialog.getByRole('status')).toHaveText(
    '1 new · 0 duplicates skipped · 2 conflicts skipped',
  );
  await expect(dialog.getByText('Conflict — skipped', { exact: true })).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Import 1 measurements', exact: true }).click();
  await page.getByLabel('Bodyweight date range', { exact: true }).selectOption('0');
  await expect(page.locator('.weight-history > div')).toHaveCount(1);
  await expect(page.locator('.weight-history')).toContainText('80.5');
});
