import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import { saveRecipePhoto } from '../src/lib/food-actions';
import { foodFixture, foodTime } from './food-fixture';
import { parseBackup, serialise } from '../src/lib/backup';

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCUcAAAAASUVORK5CYII=';
const photo = {
  id: 'meal-photo',
  name: 'meal.png',
  mime: 'image/png' as const,
  data: pixel,
  createdAt: foodTime,
};
let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('recipe-photo-' + crypto.randomUUID());
  await database.open();
  const food = foodFixture();
  await database.ingredients.bulkPut(food.ingredients);
  await database.recipes.bulkPut(food.recipes);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});

it('attaches a local photo without changing recipe details, and keeps matching draft edits', async () => {
  const before = (await database.recipes.get('rice-meal'))!;
  await database.foodDrafts.add({
    id: 'recipe-editor',
    kind: 'recipe',
    updatedAt: foodTime,
    json: JSON.stringify({
      ...before,
      name: 'My unfinished name',
      notes: 'Keep these draft notes',
    }),
  });
  await database.recipes.update(before.id, { notes: 'Keep these saved notes' });
  await saveRecipePhoto(before.id, photo, database);
  expect(await database.foodFiles.get(photo.id)).toEqual(photo);
  expect(await database.recipes.get(before.id)).toMatchObject({
    ...before,
    notes: 'Keep these saved notes',
    imageId: photo.id,
    updatedAt: expect.any(String),
  });
  const draft = JSON.parse((await database.foodDrafts.get('recipe-editor'))!.json);
  expect(draft).toMatchObject({
    name: 'My unfinished name',
    notes: 'Keep these draft notes',
    imageId: photo.id,
  });
  const restored = parseBackup(serialise(await readData(database)));
  expect(restored.data.food.foodFiles).toContainEqual(photo);
  expect(restored.data.food.recipes[0].imageId).toBe(photo.id);
});

it('replaces or removes the photo without breaking photos shared by other recipes', async () => {
  await saveRecipePhoto('rice-meal', photo, database);
  const original = (await database.recipes.get('rice-meal'))!;
  await database.recipes.add({ ...original, id: 'shared-copy', name: 'A copy' });
  await database.foodDrafts.add({
    id: 'recipe-editor',
    kind: 'recipe',
    updatedAt: foodTime,
    json: JSON.stringify({ ...original, id: 'shared-copy' }),
  });
  await saveRecipePhoto(original.id, { ...photo, id: 'new-photo' }, database);
  expect((await database.recipes.get(original.id))!.imageId).toBe('new-photo');
  expect(JSON.parse((await database.foodDrafts.get('recipe-editor'))!.json).imageId).toBe(photo.id);
  await saveRecipePhoto(original.id, undefined, database);
  expect((await database.recipes.get(original.id))!.imageId).toBeUndefined();
  expect((await database.recipes.get('shared-copy'))!.imageId).toBe(photo.id);
  expect(await database.foodFiles.get(photo.id)).toEqual(photo);
  expect(parseBackup(serialise(await readData(database))).data.food.recipes).toHaveLength(2);
});

it('keeps both the recipe and files unchanged if a photo write fails or the recipe was removed', async () => {
  const before = await database.recipes.toArray();
  await expect(saveRecipePhoto('missing', photo, database)).rejects.toThrow('no longer available');
  expect(await database.foodFiles.count()).toBe(0);
  vi.spyOn(database.recipes, 'put').mockRejectedValueOnce(new Error('Simulated storage failure'));
  await expect(saveRecipePhoto('rice-meal', photo, database)).rejects.toThrow(
    'Simulated storage failure',
  );
  expect(await database.foodFiles.count()).toBe(0);
  expect(await database.recipes.toArray()).toEqual(before);
});
