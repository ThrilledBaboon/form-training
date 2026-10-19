import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
test('climbing library, projects, saved drafts, history and system switch work together', async ({
  page,
}) => {
  await page.goto(base + '#/climbing-library');
  await page.getByRole('button', { name: 'Add climb', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Climb name', { exact: true }).fill('Purple corner');
  await dialog.getByLabel('Gym, crag or area', { exact: true }).fill('Local wall');
  await dialog.getByLabel('Grade (optional)', { exact: true }).fill('Purple');
  await dialog.getByLabel('Grade scale (optional)', { exact: true }).fill('Gym colours');
  await dialog.getByLabel('Project status', { exact: true }).selectOption('active');
  await dialog.getByLabel('Next try', { exact: true }).fill('Left foot higher');
  await dialog.getByRole('button', { name: 'Save climb', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(base + '#/climbing-projects');
  await expect(page.getByRole('heading', { name: 'Purple corner', exact: true })).toBeVisible();
  await page.goto(base + '#/climbing-log?new=1');
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Add library climb', { exact: true })
    .selectOption({ label: 'Purple corner · Purple · Local wall' });
  await dialog.getByRole('button', { name: 'Add to session', exact: true }).click();
  await dialog.getByLabel('Attempts for Purple corner', { exact: true }).fill('3');
  await dialog.getByLabel('Result for Purple corner', { exact: true }).selectOption('completed');
  await dialog.getByLabel('Notes for Purple corner', { exact: true }).fill('Try a heel hook');
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(base + '#/climbing-log');
  await page.reload();
  await page.getByRole('button', { name: 'Resume Climbing session', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Notes for Purple corner', { exact: true })).toHaveValue(
    'Try a heel hook',
  );
  await dialog.getByRole('button', { name: 'Finish session', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(base + '#/climbing-home');
  await expect(
    page.getByText('3 attempts · 1 clean completions · 0 flashes', { exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Enable Climbing system', exact: true }).uncheck();
  await page.goto(base + '#/climbing-log');
  await expect(
    page.getByRole('heading', { name: 'Climbing is switched off', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Enable climbing/i }).click();
  await expect(
    page.getByRole('button', { name: 'Edit Climbing session', exact: true }),
  ).toBeVisible();
});
