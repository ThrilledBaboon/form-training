import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import Dexie from 'dexie';
import { TrainingDB, readData } from '../src/lib/db';
import { uid, defaults, now } from '../src/lib/model';
import { foodFixture, foodTime } from './food-fixture';
import {
  saveStock,
  cookRecipe,
  saveFoodEntry,
  removeFoodEntry,
  wasteBatch,
  savePurchase,
  receivePurchase,
  regenerateShopping,
  saveMealPlan,
} from '../src/lib/food-actions';
import { recipeNutrition } from '../src/lib/food-calc';
import { serialise, parseBackup, importBackup, csvExport } from '../src/lib/backup';
import { foodTables, emptyFood } from '../src/lib/food-model';
let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('food-test-' + uid());
  await database.open();
  const food = foodFixture();
  await database.ingredients.bulkPut(food.ingredients);
  await database.recipes.bulkPut(food.recipes);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});
async function stocked() {
  await saveStock(
    {
      id: 'pack',
      ingredientId: 'rice',
      quantity: 1000,
      originalQuantity: 1000,
      unit: 'g',
      location: 'Cupboard',
      expiryKind: 'best-before',
      price: 4,
      confidence: 'confirmed',
      brand: '',
      notes: '',
      createdAt: foodTime,
    },
    database,
  );
}
function purchase() {
  return {
    id: 'p',
    retailer: 'Test shop',
    date: '2026-10-17',
    currency: 'GBP',
    total: 2,
    reviewed: true as const,
    lines: [
      {
        id: 'l',
        description: 'Rice 500g',
        ingredientId: 'rice',
        quantity: 500,
        packages: 1,
        unit: 'g' as const,
        paid: 2,
        discount: 0,
        received: false,
        location: 'Cupboard',
      },
    ],
    notes: '',
    createdAt: foodTime,
  };
}
describe('inventory transactions', () => {
  it('deducts a cooked batch once, then only portions when eaten; edits and deletion reverse portions', async () => {
    await stocked();
    const id = await cookRecipe(
      'rice-meal',
      3,
      { date: '2026-10-17', location: 'Fridge' },
      database,
    );
    expect((await database.stock.get('pack'))?.quantity).toBe(100);
    const batch = (await database.batches.get(id))!;
    expect(batch.snapshot.cost).toBeCloseTo(1.2);
    const entry = {
      id: 'e',
      recipeId: 'rice-meal',
      batchId: id,
      name: 'Rice bowl',
      date: '2026-10-17',
      slot: 'Dinner' as const,
      servings: 1,
      snapshot: batch.snapshot,
      notes: '',
      createdAt: foodTime,
    };
    await saveFoodEntry(entry, database);
    expect((await database.batches.get(id))?.remaining).toBe(2);
    expect((await database.stock.get('pack'))?.quantity).toBe(100);
    await saveFoodEntry({ ...entry, servings: 2 }, database);
    expect((await database.batches.get(id))?.remaining).toBe(1);
    await removeFoodEntry('e', database);
    expect((await database.batches.get(id))?.remaining).toBe(3);
  });
  it('rolls back all stock, batches and movements when any ingredient is insufficient', async () => {
    await stocked();
    const before = await database.movements.toArray();
    await expect(
      cookRecipe('rice-meal', 4, { date: '2026-10-17', location: 'Fridge' }, database),
    ).rejects.toThrow('Not enough');
    expect((await database.stock.get('pack'))?.quantity).toBe(1000);
    expect(await database.batches.count()).toBe(0);
    expect(await database.movements.toArray()).toEqual(before);
  });
  it('selects earliest expiry first and prevents over-consumption and waste', async () => {
    await stocked();
    await database.stock.put({
      ...(await database.stock.get('pack'))!,
      id: 'early',
      quantity: 100,
      originalQuantity: 100,
      price: 0.4,
      expires: '2026-10-18',
    });
    const id = await cookRecipe(
      'rice-meal',
      1,
      { date: '2026-10-17', location: 'Fridge' },
      database,
    );
    expect((await database.stock.get('early'))?.quantity).toBe(0);
    expect((await database.stock.get('pack'))?.quantity).toBe(800);
    await expect(wasteBatch(id, 2, 'test', database)).rejects.toThrow('Not enough');
    await wasteBatch(id, 0.5, 'Spoiled', database);
    expect((await database.batches.get(id))?.remaining).toBe(0.5);
    expect(
      (await database.movements.where('batchId').equals(id).toArray()).find(
        (m) => m.kind === 'waste',
      )?.cost,
    ).toBeCloseTo(0.6);
  });
  it('does not deduct stock when planning and preserves handwritten shopping rows on regeneration', async () => {
    await stocked();
    await database.shoppingLists.put({
      id: 'list',
      name: 'Weekly',
      from: '2026-10-17',
      to: '2026-10-23',
      items: [
        {
          id: 'manual',
          name: 'Tea towels',
          quantity: 1,
          unit: 'count',
          generated: false,
          checked: true,
          received: false,
          notes: '',
        },
      ],
      createdAt: foodTime,
      updatedAt: foodTime,
    });
    await saveMealPlan(
      {
        id: 'plan',
        recipeId: 'rice-meal',
        date: '2026-10-17',
        slot: 'Dinner',
        servings: 6,
        notes: '',
        createdAt: foodTime,
      },
      database,
    );
    const list = (await database.shoppingLists.get('list'))!;
    expect(list.items.find((i) => i.id === 'manual')?.checked).toBe(true);
    expect(list.items.find((i) => i.generated)?.shortage).toBe(800);
    expect((await database.stock.get('pack'))?.quantity).toBe(1000);
    await regenerateShopping('list', database);
    expect((await database.shoppingLists.get('list'))?.items).toHaveLength(2);
    const current = (await database.shoppingLists.get('list'))!;
    const generated = current.items.find((i) => i.generated)!;
    await database.shoppingLists.put({
      ...current,
      items: current.items.map((i) =>
        i.id === generated.id
          ? { ...i, quantity: 2000, generated: false, overridesRequirement: true }
          : i,
      ),
    });
    await regenerateShopping('list', database);
    const edited = (await database.shoppingLists.get('list'))!;
    expect(edited.items).toHaveLength(2);
    expect(edited.items.find((i) => i.ingredientId === 'rice')?.quantity).toBe(2000);
  });
});
describe('reviewed receipts', () => {
  it('requires review and explicit discrepancy/duplicate handling, and receives only once', async () => {
    const p = purchase();
    await expect(savePurchase({ ...p, reviewed: false as never }, {}, database)).rejects.toThrow();
    await expect(savePurchase({ ...p, total: 3 }, {}, database)).rejects.toThrow('Line totals');
    expect(await database.purchases.count()).toBe(0);
    await savePurchase(p, {}, database);
    expect(await database.stock.count()).toBe(0);
    await expect(savePurchase({ ...p, id: 'p2' }, {}, database)).rejects.toThrow('duplicate');
    await receivePurchase(p.id, database);
    await receivePurchase(p.id, database);
    expect(await database.stock.count()).toBe(1);
    expect((await database.stock.toArray())[0].quantity).toBe(500);
  });
  it('retains the reviewed purchase without adding stock for an ambiguous package', async () => {
    const p = purchase();
    p.lines[0].quantity = undefined as never;
    await savePurchase(p, {}, database);
    await expect(receivePurchase(p.id, database)).rejects.toThrow('package size');
    expect(await database.stock.count()).toBe(0);
    expect(await database.purchases.count()).toBe(1);
  });
});
describe('complete portable food data', () => {
  it('rejects additive consumption against an existing batch balance atomically', async () => {
    await stocked();
    const id = await cookRecipe(
      'rice-meal',
      3,
      { date: '2026-10-17', location: 'Fridge' },
      database,
    );
    const before = await readData(database);
    const file = parseBackup(serialise(before));
    file.data.food.batches[0].remaining = 2;
    file.data.food.foodEntries.push({
      id: 'new-consumption',
      recipeId: 'rice-meal',
      batchId: id,
      date: '2026-10-17',
      slot: 'Dinner',
      name: 'Rice bowl',
      servings: 1,
      snapshot: file.data.food.batches[0].snapshot,
      notes: '',
      createdAt: foodTime,
    });
    await expect(importBackup(file, 'merge', database)).rejects.toThrow(
      'inventory events conflict',
    );
    expect(await readData(database)).toEqual(before);
    expect(await database.backups.count()).toBe(0);
    await importBackup(file, 'replace', database);
    expect((await database.batches.get(id))?.remaining).toBe(2);
    expect(await database.foodEntries.count()).toBe(1);
  });
  it('round trips every food table and attachments while keeping gym history and removing retired export fields', async () => {
    await stocked();
    const before = await readData(database);
    const food = before.food!;
    const pixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCUcAAAAASUVORK5CYII=';
    food.foodFiles = [
      { id: 'image', name: 'receipt.png', mime: 'image/png', data: pixel, createdAt: foodTime },
    ];
    food.recipes[0].imageId = 'image';
    food.purchases = [{ ...purchase(), imageId: 'image' }];
    const text = serialise({ ...before, food });
    expect(JSON.parse(text).data.sessions.every((s: object) => !('calories' in s))).toBe(true);
    const backup = parseBackup(text);
    expect(backup.manifest?.attachments).toBe(1);
    await importBackup(backup, 'replace', database);
    const after = await readData(database);
    expect(after.food).toEqual(food);
    expect(after.routines).toEqual(before.routines);
    expect(await database.backups.count()).toBe(1);
    await importBackup(backup, 'merge', database);
    expect((await readData(database)).food).toEqual(food);
    const lean = await readData(database, { includeFiles: false });
    expect(lean.food?.foodFiles).toEqual([]);
    expect(lean.foodFileIds).toEqual(['image']);
    expect(() => serialise(lean)).toThrow('Attachments have not been loaded');
    expect(parseBackup(serialise(await readData(database))).data.food.foodFiles).toEqual(
      food.foodFiles,
    );
  });
  it('rejects broken references and corrupted files before any mutation', async () => {
    const before = await readData(database);
    const b = JSON.parse(serialise(before));
    b.data.food.recipes[0].ingredients[0].ingredientId = 'missing';
    expect(() => parseBackup(JSON.stringify(b))).toThrow('missing ingredient');
    expect(() => parseBackup('broken')).toThrow('valid JSON');
    expect(await database.backups.count()).toBe(0);
  });
  it('rolls back both replacement and recovery snapshot on a failed file write', async () => {
    const before = await readData(database);
    const b = parseBackup(serialise(before));
    database.foodFiles.hook('creating', () => {
      throw Error('disk full');
    });
    b.data.food.foodFiles = [
      {
        id: 'image',
        name: 'a.png',
        mime: 'image/png',
        data: 'data:image/png;base64,AA==',
        createdAt: foodTime,
      },
    ];
    b.manifest!.attachments = 1;
    await expect(importBackup(b, 'replace', database)).rejects.toThrow('disk full');
    expect(await readData(database)).toEqual(before);
    expect(await database.backups.count()).toBe(0);
  });
  it('safely imports version 2 gym backups without requiring existing users to export first', async () => {
    const before = await readData(database);
    const b = JSON.parse(serialise(before));
    b.schemaVersion = 2;
    delete b.manifest;
    delete b.data.food;
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.schemaVersion).toBe(6);
    expect(parsed.data.food).toEqual(emptyFood);
    await importBackup(parsed, 'merge', database);
    expect((await readData(database)).food?.recipes).toEqual(before.food?.recipes);
  });
  it('adds version 3 stores to a real version 2 database without altering its workout data', async () => {
    const name = 'legacy-food-' + uid();
    const old = new Dexie(name);
    old.version(2).stores({
      exercises: 'id,name,archived',
      mappings: 'id,exerciseId,muscle',
      routines: 'id,name',
      programmes: 'id',
      plans: 'id,date,status',
      sessions: 'id,status,startAt',
      sets: 'id,sessionId,exerciseId,itemId',
      bodyweights: 'id,at',
      settings: 'id',
      timers: 'id',
      backups: 'id,createdAt',
    });
    await old.open();
    const records = await readData(database);
    await old.table('settings').put({ ...defaults, unit: 'lb' });
    await old.table('routines').bulkPut(records.routines);
    await old.table('exercises').bulkPut(records.exercises);
    await old.table('sessions').put({
      id: 'retained',
      name: 'Historical workout',
      calories: 100,
      notes: 'Keep this record',
    });
    old.close();
    const upgraded = new TrainingDB(name);
    await upgraded.open();
    expect(await upgraded.sessions.get('retained')).toMatchObject({
      name: 'Historical workout',
      calories: 100,
    });
    expect((await upgraded.settings.get('preferences'))?.unit).toBe('lb');
    expect(await upgraded.routines.toArray()).toEqual(records.routines);
    for (const key of foodTables) expect(await upgraded.table(key).count()).toBe(0);
    await upgraded.delete();
  });
});
