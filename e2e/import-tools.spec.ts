import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { defaultNoteRules } from '../src/lib/note-rules';
import { readFile } from 'node:fs/promises';
const base = process.env.TEST_SUBPATH || '/';
test('rules preview, apply and persist, prompts omit notes, and JSON drafts require review', async ({
  page,
}) => {
  await page.goto(base + '#/paste-workouts');
  await page.getByText('Note parsing rules ·', { exact: false }).click();
  const rules = {
    ...defaultNoteRules,
    name: 'My pipe format',
    rules: {
      ...defaultNoteRules.rules,
      dateOrder: 'month-first',
      templates: [
        { kind: 'date', template: 'Date: {date}' },
        { kind: 'exercise', template: '{exercise} | {load} | {reps} | {sets}' },
      ],
    },
  };
  await page.getByLabel('Import note rules', { exact: true }).setInputFiles({
    name: 'rules.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(rules)),
  });
  await expect(page.getByText('Ready to apply: My pipe format')).toBeVisible();
  await page.getByRole('button', { name: 'Apply rules', exact: true }).click();
  await expect(page.getByText('Applied: My pipe format')).toBeVisible();
  await page
    .getByLabel('Workout notes', { exact: true })
    .fill('Date: 10/13/26\nBarbell bench press | 60 | 8 | 2\nNote: private-source-marker');
  await page.getByRole('button', { name: 'Parse notes', exact: true }).click();
  await expect(page.getByLabel('Workout date', { exact: true })).toHaveValue('2026-10-13');
  await expect(page.getByText('Draft saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Note parsing rules · My pipe format')).toBeVisible();
  await page.getByText('Note parsing rules · My pipe format').click();
  await page.getByRole('button', { name: 'Get prompt', exact: true }).first().click();
  const prompt = page.getByRole('dialog', { name: 'Get import prompt', exact: true });
  await expect(prompt.getByLabel('Import prompt', { exact: true })).toContainText(
    'workout-note-rules',
  );
  await expect(prompt.getByLabel('Import prompt', { exact: true })).not.toContainText(
    'private-source-marker',
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await prompt.getByRole('button', { name: 'Close dialog', exact: true }).click();
  const rulesDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export rules', exact: true }).click();
  expect(
    JSON.parse(await readFile((await (await rulesDownload).path()) as string, 'utf8')).name,
  ).toBe('My pipe format');
  await page.getByText('Import or export workout JSON', { exact: true }).click();
  const draftDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workout draft', exact: true }).click();
  const file = await readFile((await (await draftDownload).path()) as string);
  page.once('dialog', (d) => d.accept());
  await page
    .getByLabel('Import workout JSON', { exact: true })
    .setInputFiles({ name: 'draft.json', mimeType: 'application/json', buffer: file });
  await expect(page.getByLabel('I reviewed this workout', { exact: false })).not.toBeChecked();
  await page.getByRole('button', { name: 'Save reviewed workouts', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Review and confirm');
  await page.getByLabel('I reviewed this workout', { exact: false }).check();
  await page.getByRole('button', { name: 'Save reviewed workouts', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Saved 1 sessions and 0 routines');
  await page.goto(base + '#/history');
  await expect(page.getByRole('link', { name: /Workout · 2026-10-13/ })).toBeVisible();
});
test('library, layout and category import prompts open in their import flows', async ({ page }) => {
  await page.goto(base + '#/routines');
  await page.getByRole('button', { name: 'Import to library', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Import to library', exact: true })
    .getByRole('button', { name: 'Get prompt', exact: true })
    .click();
  let prompt = page.getByRole('dialog', { name: 'Get import prompt', exact: true });
  await expect(prompt.getByLabel('Import prompt', { exact: true })).toContainText('programme');
  await prompt.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Import to library', exact: true })).toBeVisible();
  await page.goto(base + '#/today');
  await page.getByText('Page options', { exact: false }).click();
  await page.getByRole('button', { name: 'Get prompt', exact: true }).click();
  prompt = page.getByRole('dialog', { name: 'Get import prompt', exact: true });
  await expect(prompt.getByLabel('Import prompt', { exact: true })).toContainText('page-layout');
  await page.goto(base + '#/settings');
  await page.getByRole('button', { name: 'Get prompt', exact: true }).click();
  prompt = page.getByRole('dialog', { name: 'Get import prompt', exact: true });
  await expect(prompt.getByLabel('Import prompt', { exact: true })).toContainText(
    'FORM category export',
  );
  const download = page.waitForEvent('download');
  await prompt.getByRole('button', { name: 'Download prompt', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('form-categories-prompt.txt');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
