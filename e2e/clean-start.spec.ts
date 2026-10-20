import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const base = process.env.TEST_SUBPATH || '/';

test('retired sample links leave personal history empty and expose no sample loader', async ({
  page,
}) => {
  await page.goto(base + '?demo=jack#/settings');
  await expect(page.getByRole('heading', { name: 'Settings & your data' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /demo data/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /demo data|demo backup/i })).toHaveCount(0);

  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export everything', exact: true }).click();
  const path = await (await downloaded).path();
  const backup = JSON.parse(await readFile(path!, 'utf8'));
  expect(backup.data.sessions).toEqual([]);
  expect(backup.data.sets).toEqual([]);
  expect(backup.data.bodyweights).toEqual([]);
  expect(backup.data.climbing.sessions).toEqual([]);
  expect(backup.data.food.foodEntries).toEqual([]);
  for (const practice of backup.data.practice) expect(practice.sessions).toEqual([]);
  expect(JSON.stringify(backup.data)).not.toMatch(/demo-jack|\[Demo\]/);
  expect(backup.data.workspace.profile?.name ?? '').toBe('');
});
