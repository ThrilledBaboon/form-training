import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { libraryFixture } from '../tests/library-fixture';
import { createLibrary, type LibraryFile } from '../src/lib/library';
const base = process.env.TEST_SUBPATH || '/';
const peer = () =>
  createLibrary(
    libraryFixture(),
    { kind: 'programme', id: 'peer-programme' },
    { notes: true, loads: true },
  );
async function choose(page: Page, file: unknown = peer()) {
  await page.getByRole('button', { name: 'Import to library', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import to library', exact: true });
  await dialog.getByLabel('Choose a library file', { exact: true }).setInputFiles({
    name: 'shared-library.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  return dialog;
}
async function downloadFile(page: Page, dialog: Locator): Promise<LibraryFile> {
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download library file', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^form-library-.*\.json$/);
  return JSON.parse(await readFile((await file.path())!, 'utf8'));
}
test.beforeEach(async ({ page }) => {
  await page.goto(base + '#/routines');
  await expect(page.getByRole('heading', { name: 'Your training, by design.' })).toBeVisible();
});

test('programme preview cancels safely, imports groups and weights, then starts a durable routine', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let dialog = await choose(page);
  await expect(dialog.getByText('3 to add · 1 already in your library')).toBeVisible();
  await expect(dialog.getByLabel('Use shared weekly schedules for new routines')).not.toBeChecked();
  await dialog.locator('summary').filter({ hasText: 'Peer upper routine' }).click();
  await expect(dialog.getByText('warmup · 20 kg · 5 reps · 45s rest')).toBeVisible();
  await expect(
    dialog.getByText(/Upper pairing · superset · 90s round rest · 15s between/),
  ).toBeVisible();
  await expect(dialog.getByText('Item coaching note')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Peer upper routine', exact: true })).toHaveCount(
    0,
  );
  dialog = await choose(page);
  await dialog.getByLabel('Use shared weekly schedules for new routines').check();
  await dialog.getByRole('button', { name: 'Add to library', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page
    .locator('.routine-card')
    .filter({ has: page.getByRole('heading', { name: 'Peer upper routine', exact: true }) });
  await expect(card).toContainText('Weekly · Thu');
  await page.reload();
  await expect(card).toBeVisible();
  dialog = await choose(page);
  await expect(dialog.getByText('0 to add · 4 already in your library')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Add to library', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await card.getByRole('button', { name: 'Start routine', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Peer upper routine', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('spinbutton', { name: 'Peer bench press set 1 load (kg)', exact: true }),
  ).toHaveValue('20');
  await expect(
    page.getByRole('spinbutton', { name: 'Peer bench press set 2 load (kg)', exact: true }),
  ).toHaveValue('60');
  await page.reload();
  await expect(
    page.getByRole('spinbutton', { name: 'Peer bench press set 2 reps', exact: true }),
  ).toHaveValue('8');
  expect(errors).toEqual([]);
});

test('library sharing downloads only selected content with optional notes/weights and accessible mobile themes', async ({
  page,
}) => {
  let dialog = await choose(page);
  await dialog.getByRole('button', { name: 'Add to library', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Share routine Peer upper routine', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Share library content', exact: true });
  await expect(dialog.getByLabel('Include library notes and descriptions')).not.toBeChecked();
  await expect(dialog.getByLabel('Include target weights')).not.toBeChecked();
  const plain = await downloadFile(page, dialog);
  expect(plain.data.routines).toHaveLength(1);
  expect(plain.data.exercises).toHaveLength(2);
  expect(plain.data.programmes).toEqual([]);
  expect(plain.data.routines[0].items[0].sets[0].loadKg).toBeUndefined();
  expect(JSON.stringify(plain)).not.toContain('coaching note');
  expect(Object.keys(plain.data).sort()).toEqual([
    'exercises',
    'mappings',
    'programmes',
    'routines',
  ]);
  await dialog.getByLabel('Include library notes and descriptions').check();
  await dialog.getByLabel('Include target weights').check();
  const withDetails = await downloadFile(page, dialog);
  expect(withDetails.data.routines[0].items[0].sets[1].loadKg).toBe(60);
  expect(JSON.stringify(withDetails)).toContain('Item coaching note');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Programmes', exact: true }).click();
  await page
    .getByRole('button', { name: 'Share programme Shared strength programme', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: 'Share library content', exact: true });
  const programme = await downloadFile(page, dialog);
  expect(programme.data.programmes).toHaveLength(1);
  expect(programme.data.routines).toHaveLength(1);
  expect(programme.data.routines[0].programmeId).toBe(programme.data.programmes[0].id);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Programmes', exact: true })
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await page.goto(base + '#/exercises');
  await page.getByRole('button', { name: 'Share exercise Peer bench press', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Share library content', exact: true });
  const exercise = await downloadFile(page, dialog);
  expect(exercise.data.exercises).toHaveLength(1);
  expect(exercise.data.routines).toEqual([]);
  expect(exercise.data.mappings).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  for (const theme of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.getByRole('button', { name: 'Toggle colour theme' }).click();
    const opener = page.getByRole('button', { name: 'Share library', exact: true });
    await opener.click();
    dialog = page.getByRole('dialog', { name: 'Share library content', exact: true });
    await expect(dialog).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/library-share-${theme}-${test.info().project.name}.png`,
    });
    const all = await downloadFile(page, dialog);
    expect(all.data.exercises).toHaveLength(36);
    expect(all.data.routines).toHaveLength(4);
    expect(all.data.programmes).toHaveLength(1);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    dialog = await choose(page);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/library-import-${theme}-${test.info().project.name}.png`,
    });
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 320, height: 750 });
  for (const route of ['exercises', 'routines']) {
    await page.goto(base + '#/' + route);
    await expect(
      page.getByRole('heading', {
        name: route === 'exercises' ? 'Exercise library' : 'Your training, by design.',
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      .toBe(true);
    await expect(
      page.getByRole('button', { name: 'Import to library', exact: true }),
    ).toBeVisible();
  }
});

test('invalid or full-backup files cannot change the library and new routines stay unscheduled by default', async ({
  page,
}) => {
  let dialog = await choose(page, { app: 'FORM', schemaVersion: 2, data: libraryFixture() });
  await expect(dialog.getByRole('alert')).toContainText('Full backups belong in Settings & data');
  await expect(dialog.getByRole('button', { name: 'Add to library', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.routine-card')).toHaveCount(3);
  const invalid = peer();
  invalid.data.routines[0].items[0].exerciseId = 'missing';
  dialog = await choose(page, invalid);
  await expect(dialog.getByRole('alert')).toContainText('missing or incompatible exercise');
  await expect(dialog.getByRole('button', { name: 'Add to library', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  dialog = await choose(page);
  await dialog.getByRole('button', { name: 'Add to library', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page
    .locator('.routine-card')
    .filter({ has: page.getByRole('heading', { name: 'Peer upper routine', exact: true }) });
  await expect(card).not.toContainText('Weekly');
  await page.reload();
  await expect(card).toBeVisible();
  await page.goto(base + '#/history');
  await expect(page.getByRole('heading', { name: 'Upper session', exact: true })).toHaveCount(0);
});
