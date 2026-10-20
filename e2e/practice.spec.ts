import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
test('Rocket League is opt-in, runs a saved warm-up, records results and keeps them when hidden', async ({
  page,
}) => {
  await page.goto(base + '#/rocket-league-home');
  await expect(page.getByRole('heading', { name: 'Rocket League is switched off' })).toBeVisible();
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Enable Rocket League system', exact: true }).check();
  await page.goto(base + '#/rocket-league-library');
  await page.getByRole('button', { name: 'Add starter warm-ups', exact: true }).click();
  await expect(page.getByRole('heading', { name: '5-minute warm-up', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Practice goals', exact: true }).click();
  await page.getByLabel('Sessions per week').fill('4');
  await page.getByLabel('Current focus', { exact: true }).fill('Shooting with control');
  await page.getByRole('button', { name: 'Save goals', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Shooting accuracy', exact: true }).click();
  await page.getByLabel('Training pack code').fill('TEST-1234-ABCD-EFGH');
  await page.getByLabel('Setup / difficulty').fill('Stationary ball at midfield');
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Save drill', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(base + '#/rocket-league-home');
  await expect(page.getByRole('progressbar', { name: 'Weekly practice goal' })).toHaveAttribute(
    'max',
    '4',
  );
  await page.getByRole('button', { name: 'Start 5-minute warm-up', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ball control', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume timer', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume timer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Complete without results', exact: true }).click();
  await page.getByRole('button', { name: 'Next set', exact: true }).click();
  await expect(page.getByText('TEST-1234-ABCD-EFGH', { exact: true })).toBeVisible();
  await page.getByLabel('Attempts', { exact: true }).fill('10');
  await page.getByLabel('Hits', { exact: true }).fill('7');
  await page.getByLabel('Set notes', { exact: true }).fill('Kept the approach consistent');
  await page.getByRole('button', { name: 'Record & rest', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Finish session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Practice history', exact: true })).toBeVisible();
  await page
    .getByLabel('Drill & setup')
    .selectOption({ label: 'Shooting accuracy · both · Stationary ball at midfield' });
  await expect(page.getByText('Personal best:', { exact: false })).toContainText('70.0 %');
  await page.getByRole('button', { name: 'View 5-minute warm-up', exact: true }).click();
  await page.getByText('Shooting accuracy · set 1 · completed', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Set notes', exact: true })).toHaveValue(
    'Kept the approach consistent',
  );
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.context().setOffline(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Enable Rocket League system', exact: true }).uncheck();
  await page.goto(base + '#/rocket-league-history');
  await expect(page.getByRole('heading', { name: 'Rocket League is switched off' })).toBeVisible();
  await page.getByRole('button', { name: 'Enable rocket-league', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'View 5-minute warm-up', exact: true }),
  ).toBeVisible();
});

test('Football tracks keepy-ups, editable courses, foot-specific shooting and shared routines independently', async ({
  page,
}) => {
  await page.goto(base + '#/settings');
  await page.getByRole('switch', { name: 'Enable Football system', exact: true }).check();
  await page.goto(base + '#/football-library');
  await page.getByRole('button', { name: 'Add starter football drills', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ball control warm-up', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit Cone slalom', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add cone', exact: true }).click();
  await dialog.getByLabel('Cone 6 x', { exact: true }).fill('70');
  await dialog.getByLabel('Cone 6 y', { exact: true }).fill('85');
  await dialog.getByLabel('Foot', { exact: true }).selectOption('right');
  await dialog.getByRole('button', { name: 'Save drill', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Edit Cone slalom', exact: true }).click();
  await expect(page.getByLabel('Cone 6 x', { exact: true })).toHaveValue('70');
  await expect(page.getByLabel('Foot', { exact: true })).toHaveValue('right');
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByLabel('Available space', { exact: true }).selectOption('small');
  await page.getByLabel('Solo drills only', { exact: true }).check();
  await expect(page.getByRole('button', { name: 'Edit Cone slalom', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Keepy-ups', exact: true })).toBeVisible();
  await page.goto(base + '#/football-home');
  await page.getByRole('button', { name: 'Start Ball control warm-up', exact: true }).click();
  await page
    .getByLabel('Attempt streaks (comma separated, optional)', { exact: true })
    .fill('8, 12, 7, 15');
  await page.getByRole('button', { name: 'Record & rest', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Finish session', exact: true }).click();
  await expect(page.getByText('Latest session:', { exact: false })).toContainText(
    'typical streak 10',
  );
  await page.goto(base + '#/football-library');
  await page.getByRole('button', { name: 'Edit Target shooting', exact: true }).click();
  await page.getByLabel('Foot', { exact: true }).selectOption('left');
  await page.getByRole('button', { name: 'Save drill', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'New routine', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Routine name', { exact: true }).fill('Left foot targets');
  await dialog
    .getByLabel('Drill for block 1', { exact: true })
    .selectOption({ label: 'Target shooting' });
  await dialog.getByLabel('Work timer (seconds; 0 = open)', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share Left foot targets', exact: true }).click();
  const download = await downloadEvent;
  const file = await download.path();
  await page.getByLabel('Import practice library', { exact: true }).setInputFiles(file!);
  await page.getByRole('button', { name: 'Import library', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(base + '#/football-session');
  await page.getByRole('button', { name: 'Start Left foot targets', exact: true }).first().click();
  await page.getByLabel('Record each attempt on the target map', { exact: true }).check();
  await page.getByRole('button', { name: /Top right/ }).click();
  await page.getByRole('button', { name: 'Hit target', exact: true }).click();
  await page.getByRole('button', { name: 'Hit target', exact: true }).click();
  await page.getByRole('button', { name: 'Missed target', exact: true }).click();
  await page.getByRole('button', { name: 'Undo last attempt', exact: true }).click();
  await page.getByRole('button', { name: /Bottom left/ }).click();
  await page.getByRole('button', { name: 'Missed target', exact: true }).click();
  await expect(page.getByText('2 hits / 3 attempts', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Record & rest', exact: true }).click();
  await page.getByRole('button', { name: 'Finish session', exact: true }).click();
  await page.getByLabel('Drill & setup', { exact: true }).selectOption({
    label: 'Target shooting · left · Stationary ball, 10 metres from goal. Aim at a chosen zone.',
  });
  await expect(page.getByText('Personal best:', { exact: false })).toContainText('66.7 %');
  await expect(page.getByText('right:', { exact: false })).toContainText('Unrecorded');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(base + '#/rocket-league-home');
  await expect(
    page.getByRole('heading', { name: 'Rocket League is switched off', exact: true }),
  ).toBeVisible();
});
