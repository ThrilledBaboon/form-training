import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixture } from '../tests/fixtures';
import { defaultWorkspace, makeWidget } from '../src/lib/workspace-model';
import { serialise } from '../src/lib/backup';
const base = process.env.TEST_SUBPATH || '/';
async function route(page: Page, path: string) {
  await page.goto(base + '#/' + path);
}
test('personal settings persist, keep Settings reachable, and apply food and climbing defaults', async ({
  page,
}) => {
  await route(page, 'settings');
  const panel = page.locator('.personalisation-settings');
  await panel.getByLabel('Interface spacing', { exact: true }).selectOption('compact');
  await panel.getByLabel('Text size', { exact: true }).selectOption('large');
  await panel.getByLabel('Stronger contrast', { exact: true }).check();
  await panel
    .locator('summary')
    .filter({ hasText: /^Navigation & your words$/ })
    .click();
  await panel.getByLabel('Navigation label for today', { exact: true }).fill('My day');
  await panel.getByLabel('Show food-budget', { exact: true }).uncheck();
  await expect(panel.getByLabel('Show settings', { exact: true })).toBeDisabled();
  await panel
    .locator('summary')
    .filter({ hasText: /^Phone shortcuts$/ })
    .click();
  await panel.getByLabel('Phone shortcut 4', { exact: true }).selectOption('');
  await panel.getByLabel('Phone shortcut 1', { exact: true }).selectOption('climbing-home');
  await panel
    .locator('summary')
    .filter({ hasText: /^Food display$/ })
    .click();
  await panel.getByLabel('Carbs', { exact: true }).uncheck();
  await panel.getByLabel('Fat', { exact: true }).uncheck();
  await panel.getByLabel('Fibre', { exact: true }).uncheck();
  await panel.getByLabel('Daily macro numbers', { exact: true }).selectOption('both');
  await panel
    .locator('summary')
    .filter({ hasText: /^Logging defaults$/ })
    .click();
  await panel.getByLabel('Preferred effort scale', { exact: true }).selectOption('rir');
  await panel.getByLabel('Default climbing type', { exact: true }).selectOption('lead');
  await panel.getByLabel('Usual climbing venue', { exact: true }).fill('My local wall');
  await panel.getByLabel('Preferred climbing grade scale', { exact: true }).fill('French');
  await panel.getByLabel('Your climbing tags', { exact: true }).fill('footwork, balance');
  await panel.getByRole('button', { name: 'Save customisation', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await page.reload();
  await expect(panel.getByLabel('Interface spacing', { exact: true })).toHaveValue('compact');
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await expect(navigation.getByRole('link', { name: 'My day', exact: true })).toHaveCount(1);
  await expect(navigation.getByRole('link', { name: 'Food spending', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Settings & data', exact: true })).toHaveCount(
    1,
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await route(page, 'food-home');
  const macros = page.getByRole('region', { name: 'Daily macros', exact: true });
  await expect(macros.locator('dt')).toHaveText(['Protein']);
  await expect(macros).not.toContainText('Estimated calories');
  await expect(
    page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link').first(),
  ).toHaveText('Climb');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await route(page, 'climbing-library');
  await page.getByRole('button', { name: 'Add climb', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Climbing type', { exact: true })).toHaveValue('lead');
  await expect(dialog.getByLabel('Gym, crag or area', { exact: true })).toHaveValue(
    'My local wall',
  );
  await expect(dialog.getByLabel('Grade scale (optional)', { exact: true })).toHaveValue('French');
  await dialog.getByLabel('Climb name', { exact: true }).fill('Balance test');
  await dialog.getByLabel('Grade (optional)', { exact: true }).fill('6a');
  await dialog.getByRole('button', { name: 'footwork', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save climb', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Balance test', exact: true })).toBeVisible();
  await expect(page.locator('.climbing-tags')).toContainText('footwork');
});

test('page design, phone order, chart overrides and shared presets stay editable and work offline', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const data = fixture();
  data.workspace = defaultWorkspace();
  data.bodyweights = [
    ['2026-09-01', 82],
    ['2026-09-03', 81],
    ['2026-09-14', 80],
    ['2026-10-10', 79],
  ].map(([day, kg], i) => ({
    id: 'weight-' + i,
    at: day + 'T12:00:00.000Z',
    kg: Number(kg),
    notes: '',
  }));
  data.workspace.pages.push({
    id: 'personal-desk',
    name: 'Personal desk',
    range: { days: 0 },
    revision: 0,
    widgets: [
      { ...makeWidget('notes', { note: 'PRIVATE REMINDER' }, 'note'), title: 'My notes' },
      makeWidget('bodyweight', {}, 'weight'),
      {
        ...makeWidget(
          'personal-goal',
          { goalCurrent: 7, goalTarget: 10, goalUnit: 'visits' },
          'goal',
        ),
        title: 'My project',
      },
    ],
  });
  await route(page, 'settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'personal-desk.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialise(data)),
  });
  await page.getByRole('dialog').getByLabel('Import method').selectOption('replace');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Confirm replace import', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await route(page, 'pages?page=personal-desk');
  await page.locator('.workspace-page-options > summary').click();
  await page.getByRole('button', { name: 'Customise page', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Page spacing', { exact: true }).selectOption('compact');
  await dialog.getByRole('button', { name: 'Add section', exact: true }).click();
  await dialog.getByLabel('Section 1 title', { exact: true }).fill('Long term');
  await dialog.getByLabel('Start collapsed', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Save page design', exact: true }).click();
  await page.getByRole('button', { name: 'Edit page', exact: true }).click();
  const weight = page.getByRole('region', { name: 'Bodyweight trend', exact: true });
  await weight.getByRole('button', { name: 'Configure widget', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Page section', { exact: true }).selectOption({ label: 'Long term' });
  await dialog
    .locator('summary')
    .filter({ hasText: /^Appearance & phone layout$/ })
    .click();
  await dialog.getByLabel('Widget accent', { exact: true }).selectOption('blue');
  await dialog.getByLabel('Show date and status subtitle', { exact: true }).uncheck();
  await dialog.getByLabel('Show Explore link', { exact: true }).uncheck();
  await dialog.getByLabel('Use custom chart display for this widget', { exact: true }).check();
  await dialog.getByLabel('Chart style', { exact: true }).selectOption('bar');
  await dialog.getByLabel('Chart points', { exact: true }).selectOption('weekly');
  await dialog.getByLabel('Chart target line (optional)', { exact: true }).fill('75');
  await dialog.getByLabel('Use chart patterns as well as colour', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Save widget', exact: true }).click();
  await page.getByLabel('Edit layout for', { exact: true }).selectOption('phone');
  const goal = page.getByRole('region', { name: 'My project', exact: true });
  await goal.getByRole('button', { name: 'Move widget up', exact: true }).click();
  await goal.getByLabel('Resize widget', { exact: true }).selectOption('half');
  await expect(page.locator('.workspace-widget').first()).toHaveAttribute('data-widget-id', 'goal');
  await page.getByLabel('Edit layout for', { exact: true }).selectOption('desktop');
  await expect(page.locator('.workspace-widget').first()).toHaveAttribute('data-widget-id', 'note');
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  await expect(weight).toBeHidden();
  await page.getByRole('button', { name: 'Dismiss message', exact: true }).click();
  await page.getByRole('button', { name: 'Long term', exact: true }).click();
  await expect(weight.getByRole('img', { name: /3 weekly averages/ })).toBeVisible();
  await expect(weight.locator('.recharts-bar')).toBeVisible();
  await expect(weight.locator('.recharts-reference-line-line')).toHaveCount(1);
  await expect(weight.getByText('Target', { exact: true })).toBeVisible();
  await expect(weight.getByRole('link', { name: 'Explore Bodyweight trend' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Share layout', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Include my theme, spacing and chart appearance', { exact: true })
    .check();
  const text = await dialog.getByLabel('Layout file preview').inputValue();
  expect(text).not.toContain('PRIVATE REMINDER');
  expect(
    JSON.parse(text).page.widgets.find((w: { type: string }) => w.type === 'personal-goal').config
      .goalCurrent,
  ).toBe(0);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByLabel('Choose a page layout').setInputFiles({
    name: 'shared.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(
    page.getByLabel('Also use the shared theme and display preferences', { exact: false }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Import reviewed layout', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'My project', exact: true })).toContainText('0');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.reload();
  await expect(page.locator('.workspace-widget').first()).toHaveAccessibleName('My project');
  await page.getByRole('button', { name: 'Long term', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `test-results/personalisation-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Long term', exact: true }).click();
  await expect(page.getByRole('img', { name: /3 weekly averages/ })).toBeVisible();
  await context.setOffline(false);
  await page.locator('.workspace-page-options > summary').click();
  await page.getByRole('button', { name: 'Customise page', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Show page sections as', { exact: true }).selectOption('tabs');
  await dialog.getByRole('button', { name: 'Save page design', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss message', exact: true }).click();
  await page.getByRole('button', { name: 'Long term', exact: true }).click();
  await expect(page.getByRole('region', { name: 'My project', exact: true })).toBeHidden();
  await expect(page.getByRole('img', { name: /3 weekly averages/ })).toBeVisible();
  await page.getByRole('button', { name: 'Customise page', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Remove section 1', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save page design', exact: true }).click();
  await expect(page.getByRole('region', { name: 'My project', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /3 weekly averages/ })).toBeVisible();
  expect(errors).toEqual([]);
});
