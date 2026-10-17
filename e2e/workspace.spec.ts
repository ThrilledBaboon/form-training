import { test, expect, type Page } from '@playwright/test';
import { fixture } from '../tests/fixtures';
import { defaultWorkspace, makeWidget } from '../src/lib/workspace-model';
import { serialise } from '../src/lib/backup';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_SUBPATH || '/';
async function route(page: Page, path: string) {
  await page.goto(base + '#/' + path);
}
async function createPage(page: Page, name: string) {
  await page.getByRole('button', { name: 'My pages', exact: true }).click();
  await page.getByRole('button', { name: 'Create page', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Page name', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Save page', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
async function addWidget(page: Page, name: string, title?: string, note?: string) {
  await page.getByRole('button', { name: 'Add widget', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Find a widget').fill(name);
  await page.getByRole('button', { name: 'Add ' + name, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Configure widget', exact: true });
  await expect(dialog).toBeVisible();
  if (title) await dialog.getByLabel('Widget title (optional)').fill(title);
  if (note) await dialog.getByLabel('Personal notes', { exact: true }).fill(note);
  await dialog.getByRole('button', { name: 'Save widget', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
test.beforeEach(async ({ page }) => {
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Make room for progress.' })).toBeVisible();
});
test('custom pages edit, duplicate, move, resize, undo and persist with a chosen home', async ({
  page,
}) => {
  await createPage(page, 'My training desk');
  await page.getByRole('button', { name: 'Edit page', exact: true }).click();
  await addWidget(page, 'Personal notes', 'Training notes', 'Steady reps');
  await addWidget(page, 'Personal notes', 'Food notes', 'Remember lunch');
  const first = page.locator('.workspace-widget').first();
  await first.getByLabel('Duplicate widget', { exact: true }).click();
  await expect(page.locator('.workspace-widget')).toHaveCount(3);
  await page
    .locator('.workspace-widget')
    .last()
    .getByLabel('Move widget up', { exact: true })
    .click();
  await page.locator('.workspace-widget').first().getByLabel('Resize widget').selectOption('wide');
  await expect(page.locator('.workspace-widget').first()).toHaveClass(/widget-size-wide/);
  await page
    .locator('.workspace-widget')
    .last()
    .getByLabel('Remove widget', { exact: true })
    .click();
  await expect(page.locator('.workspace-widget')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.workspace-widget')).toHaveCount(3);
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  const url = page.url();
  await page.reload();
  await expect(page.locator('.workspace-widget')).toHaveCount(3);
  await expect(page.locator('.workspace-widget').first()).toHaveClass(/widget-size-wide/);
  await page.getByRole('button', { name: 'My pages', exact: true }).click();
  await page.getByRole('button', { name: 'Make My training desk home', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'My training desk', exact: true })).toBeVisible();
  await page.goto(url);
  await page.getByRole('button', { name: 'My pages', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete My training desk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make room for progress.' })).toBeVisible();
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Make room for progress.' })).toBeVisible();
});
test('all system combinations hide routes and widgets while retaining an active workout and its positions', async ({
  page,
}) => {
  const ids = await page
    .locator('.workspace-widget')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-widget-id')));
  await page.getByRole('button', { name: 'Start a workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Freestyle workout', exact: true })).toBeVisible();
  for (const [gym, food] of [
    [true, false],
    [false, true],
    [false, false],
    [true, true],
  ]) {
    await route(page, 'settings');
    await page.getByRole('switch', { name: 'Enable Gym system' }).setChecked(gym);
    await page.getByRole('switch', { name: 'Enable Food system' }).setChecked(food);
    await route(page, 'today');
    await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toHaveCount(
      gym ? 1 : 0,
    );
    await expect(page.getByRole('heading', { name: 'Daily macros', exact: true })).toHaveCount(
      food ? 1 : 0,
    );
    await route(page, 'workout');
    if (!gym) {
      await expect(page.getByRole('heading', { name: /Gym is switched off/ })).toBeVisible();
    } else
      await expect(
        page.getByRole('heading', { name: 'Freestyle workout', exact: true }),
      ).toBeVisible();
    await route(page, 'food-diary');
    if (!food)
      await expect(page.getByRole('heading', { name: /Food is switched off/ })).toBeVisible();
    else await expect(page.getByRole('heading', { name: 'Food diary', exact: true })).toBeVisible();
    await route(page, 'weight');
    await expect(page.getByRole('heading', { name: 'Bodyweight', exact: true })).toBeVisible();
  }
  await route(page, 'today');
  expect(
    await page
      .locator('.workspace-widget')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-widget-id'))),
  ).toEqual(ids);
});
test('shares an actual private layout preview, imports safely, and catches duplicate or wrong files', async ({
  page,
}) => {
  await createPage(page, 'Shared desk');
  await page.getByRole('button', { name: 'Edit page', exact: true }).click();
  await addWidget(page, 'Personal notes', 'My reminder', 'PRIVATE REMINDER');
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  await page.getByRole('button', { name: 'Share layout', exact: true }).click();
  const share = page.getByRole('dialog');
  const exported = await share.getByLabel('Layout file preview').inputValue();
  expect(exported).not.toContain('PRIVATE REMINDER');
  expect(JSON.parse(exported).type).toBe('page-layout');
  await share.getByRole('button', { name: 'Close', exact: true }).click();
  const file = { name: 'layout.json', mimeType: 'application/json', buffer: Buffer.from(exported) };
  await page.getByLabel('Choose a page layout').setInputFiles(file);
  await expect(page.getByRole('dialog', { name: 'Review shared layout' })).toBeVisible();
  await page.getByRole('button', { name: 'Import reviewed layout', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Choose a page layout').setInputFiles(file);
  await page.getByRole('button', { name: 'Import reviewed layout', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.toast')).toContainText('already imported');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page
    .getByLabel('Choose a page layout')
    .setInputFiles({ ...file, buffer: Buffer.from('{"app":"FORM","type":"library"}') });
  await expect(page.locator('.toast')).toContainText('page-layout');
  await expect(page.getByRole('heading', { name: 'Shared desk', exact: true })).toBeVisible();
});
test('pasted notes survive refresh and save reviewed date-only history plus unscheduled routines', async ({
  page,
}) => {
  await route(page, 'paste-workouts');
  await page
    .getByLabel('Workout notes', { exact: true })
    .fill(
      '13.10.26\nBarbell bench press 30 kg 8 reps\n1. 1\n2. 2\n3. 3, 35kg instead\nNote: could go slower',
    );
  await page.getByRole('button', { name: 'Parse notes', exact: true }).click();
  await expect(page.getByLabel('Workout date', { exact: true })).toHaveValue('2026-10-13');
  await expect(page.getByText('Draft saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Workout date', { exact: true })).toHaveValue('2026-10-13');
  await page.getByLabel('I reviewed this workout', { exact: false }).check();
  await page.getByLabel('Save reviewed workouts as').selectOption('both');
  await page.getByRole('button', { name: 'Save reviewed workouts', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Saved 1 sessions and 1 routines');
  await route(page, 'history');
  await page.getByRole('link', { name: /Workout · 2026-10-13/ }).click();
  await expect(page.getByText('Duration unrecorded', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Workout date', { exact: true })).toHaveValue(
    '2026-10-13',
  );
  await expect(page.getByRole('dialog').getByLabel('Start time', { exact: true })).toHaveCount(0);
});
test('equipment profiles are available during a workout and keep recorded loads per dumbbell', async ({
  page,
}) => {
  await route(page, 'setups?exercise=exercise-barbell-bench-press');
  await page.getByRole('button', { name: 'Create setup', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Setup name', { exact: true }).fill('My gym bench');
  await dialog.getByLabel('Machine settings').fill('Seat 3');
  await dialog.getByLabel('How loads are entered').selectOption('per_dumbbell');
  await dialog.getByLabel('Available increment (kg)').fill('1.25');
  await dialog.getByLabel('Use by default for future workouts of this exercise').check();
  await dialog.getByRole('button', { name: 'Save setup', exact: true }).click();
  await route(page, 'today');
  await page.getByRole('button', { name: 'Start a workout', exact: true }).click();
  await page.getByRole('button', { name: 'Add your first exercise', exact: true }).click();
  await page.getByLabel('Find an exercise').fill('Barbell bench press');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Barbell bench press Barbell', exact: false })
    .click();
  await expect(page.getByLabel('Equipment setup for Barbell bench press')).toHaveValue(/.+/);
  await expect(page.getByText('Seat 3', { exact: false })).toBeVisible();
  const load = page.getByRole('spinbutton', {
    name: 'Barbell bench press set 1 load (kg)',
    exact: true,
  });
  await load.fill('15');
  await load.blur();
  await page
    .getByRole('spinbutton', { name: 'Barbell bench press set 1 reps', exact: true })
    .fill('8');
  await page
    .getByRole('button', { name: 'Complete Barbell bench press set 1', exact: true })
    .click();
  await page.reload();
  await expect(load).toHaveValue('15');
  await expect(
    page.getByText('My gym bench · per dumbbell', { exact: false }).first(),
  ).toBeVisible();
});
test('analytics filters carry into independent widgets, narrow grids and keyboard editing remain accessible', async ({
  page,
}) => {
  await route(page, 'progress?exercise=exercise-barbell-bench-press&metric=reps&days=30');
  await expect(page.getByLabel('Chart metric', { exact: true })).toHaveValue('reps');
  await page.getByRole('button', { name: 'Add to page', exact: true }).click();
  await page.getByRole('button', { name: 'Add widget to page', exact: true }).click();
  await route(page, 'today');
  const widget = page.getByRole('region', { name: 'Exercise progression', exact: true });
  await expect(widget).toBeVisible();
  await expect(widget.getByRole('link', { name: 'Explore Exercise progression' })).toHaveAttribute(
    'href',
    /metric=reps/,
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Edit page', exact: true }).click();
  await widget.getByRole('button', { name: 'Configure widget', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Widget metric')).toHaveValue('reps');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const violations = (
    await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  ).violations;
  expect(violations).toEqual([]);
  await page.screenshot({
    path: `test-results/workspace-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('a mixed page with repeated real charts updates from history, keeps unique SVG IDs and reloads offline', async ({
  page,
  context,
}) => {
  const data = fixture();
  data.workspace = defaultWorkspace();
  data.bodyweights = [{ id: 'test-weight', at: new Date().toISOString(), kg: 80, notes: '' }];
  const exerciseId = data.exercises.find((e) => e.name === 'Barbell bench press')!.id;
  data.workspace.pages.push({
    id: 'mixed-desk',
    name: 'Mixed desk',
    range: { days: 0 },
    revision: 0,
    widgets: [
      makeWidget('exercise', { exerciseId, metric: 'bestLoad' }),
      makeWidget('exercise', { exerciseId, metric: 'bestLoad' }),
      makeWidget('exercise', { exerciseId, metric: 'reps' }),
      makeWidget('bodyweight'),
      makeWidget('muscle-map'),
      makeWidget('muscle-trend'),
      makeWidget('macro-summary'),
      makeWidget('shortages'),
      makeWidget('spending', { spendingPeriod: 'month' }),
      makeWidget('notes', { note: 'Offline reminder' }),
    ],
  });
  await route(page, 'settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'synthetic-workspace.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise(data)),
  });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Import method').selectOption('replace');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm replace import', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await route(page, 'pages?page=mixed-desk');
  await expect(
    page.getByRole('img', {
      name: /Barbell bench press bestLoad: 1 recorded points. Latest 60 kg/,
    }),
  ).toHaveCount(2);
  await route(page, 'history?session=s1');
  const load = page.getByRole('spinbutton', {
    name: 'Barbell bench press set 1 load (kg)',
    exact: true,
  });
  await load.fill('65');
  await load.blur();
  await route(page, 'pages?page=mixed-desk');
  await expect(
    page.getByRole('img', {
      name: /Barbell bench press bestLoad: 1 recorded points. Latest 65 kg/,
    }),
  ).toHaveCount(2);
  const ids = await page
    .locator('linearGradient[id]')
    .evaluateAll((nodes) => nodes.map((n) => n.id));
  expect(ids.length).toBeGreaterThan(3);
  expect(new Set(ids).size).toBe(ids.length);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mixed desk', exact: true })).toBeVisible();
  await expect(page.getByText('Offline reminder', { exact: true })).toBeVisible();
  await expect(page.locator('.workspace-widget')).toHaveCount(10);
  await page.getByRole('button', { name: 'Edit page', exact: true }).click();
  await page
    .locator('.workspace-widget')
    .last()
    .getByRole('button', { name: 'Duplicate widget', exact: true })
    .click();
  await expect(page.locator('.workspace-widget')).toHaveCount(11);
  await page.reload();
  await expect(page.locator('.workspace-widget')).toHaveCount(11);
  await context.setOffline(false);
  await page.screenshot({
    path: `test-results/workspace-mixed-${test.info().project.name}.png`,
    fullPage: true,
  });
});
