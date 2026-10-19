import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionFixture } from '../tests/session-fixture';
const base = process.env.TEST_SUBPATH || '/';
test('active workout brings forward earlier exercise and set notes without opening notes controls', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-15T15:00:00Z') });
  const data = sessionFixture();
  data.sessions[0].items[0].notes = 'Keep the lowering phase controlled';
  data.sets[0].notes = 'Pause at the bottom';
  data.sets[0].partialReps = 2;
  await page.goto(base + '#/settings');
  await page.getByLabel('Choose a JSON backup', { exact: true }).setInputFiles({
    name: 'continuity.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        app: 'FORM',
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        data,
      }),
    ),
  });
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Import method').selectOption('replace');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Confirm replace import' }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(base + '#/today');
  await page.getByRole('button', { name: 'Suggest session', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Suggested session', exact: true });
  await dialog.getByRole('button', { name: 'Start suggested session', exact: true }).click();
  const reminders = page.getByRole('complementary', {
    name: 'Barbell bench press session reminders',
    exact: true,
  });
  await expect(reminders).toContainText('Keep the lowering phase controlled');
  await expect(reminders).toContainText('Pause at the bottom');
  await expect(reminders).toContainText('2 partial reps recorded separately');
  await page.reload();
  await expect(reminders).toContainText('Keep the lowering phase controlled');
  expect(
    (await new AxeBuilder({ page }).include('.session-continuity').analyze()).violations,
  ).toEqual([]);
  await reminders.screenshot({
    path: `test-results/session-reminders-${test.info().project.name}.png`,
  });
});
