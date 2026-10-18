import { afterEach, beforeEach, expect, it } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import { uid } from '../src/lib/model';
import { saveProfile } from '../src/lib/profile';
import { ageOn, ProfileSchema } from '../src/lib/profile-model';
import { serialise, parseBackup, importBackup } from '../src/lib/backup';
import { exportLayout } from '../src/lib/layout-sharing';
let database: TrainingDB;
beforeEach(async () => {
  database = new TrainingDB('profile-' + uid());
  await database.open();
});
afterEach(async () => {
  await database.delete();
});
it('saves optional profile and goal atomically and maintains one initial weigh-in across edits', async () => {
  await saveProfile(
    { name: 'Sam', birthday: '1998-03-12', heightCm: 175, initialWeightKg: 70 },
    75,
    database,
  );
  let data = await readData(database);
  const initialId = data.workspace!.profile!.initialWeightEntryId;
  expect(data.bodyweights).toHaveLength(1);
  await saveProfile({ ...data.workspace!.profile!, heightCm: 176 }, 75, database);
  expect((await readData(database)).bodyweights).toHaveLength(1);
  await saveProfile({ ...data.workspace!.profile!, initialWeightKg: 71 }, 75, database);
  data = await readData(database);
  expect(data.bodyweights).toHaveLength(1);
  expect(data.bodyweights[0]).toMatchObject({ id: initialId, kg: 71 });
  expect(data.settings.goalKg).toBe(75);
  const before = serialise(data);
  await expect(saveProfile({ name: 'Bad', heightCm: 20 }, 0, database)).rejects.toThrow();
  expect((await readData(database)).workspace).toEqual(data.workspace);
  expect(parseBackup(before).data.workspace!.profile).toEqual(data.workspace!.profile);
  const layout = exportLayout(data.workspace!.pages[0], data);
  for (const privateValue of ['1998-03-12', 'initialWeightKg', 'heightCm', 'initialWeightEntryId'])
    expect(layout).not.toContain(privateValue);
});
it('allows skipping every field and rejects invalid birthdays and future birthdays', async () => {
  expect(ProfileSchema.safeParse({ name: '', birthday: '2026-02-31' }).success).toBe(false);
  expect(ProfileSchema.safeParse({ name: '', birthday: '2999-01-01' }).success).toBe(false);
  expect(ageOn('2000-10-18', new Date('2026-10-17T12:00:00'))).toBe(25);
  expect(ageOn('2000-10-18', new Date('2026-10-18T12:00:00'))).toBe(26);
  await saveProfile({ name: '' }, undefined, database);
  expect((await readData(database)).workspace!.profile!.onboarding).toBe('completed');
  expect(await database.bodyweights.count()).toBe(0);
});
it('restores profile only when requested during a merge and never recreates a deleted starting measurement', async () => {
  await saveProfile({ name: 'Source', initialWeightKg: 70 }, 75, database);
  const backup = parseBackup(serialise(await readData(database)));
  const profile = (await readData(database)).workspace!.profile!;
  await database.bodyweights.clear();
  await saveProfile(profile, 75, database);
  expect(await database.bodyweights.count()).toBe(0);
  await saveProfile({ ...profile, name: 'Local' }, 80, database);
  await importBackup(backup, 'merge', database);
  expect((await readData(database)).workspace!.profile!.name).toBe('Local');
  await importBackup(backup, 'merge', database, { restorePreferences: true });
  expect((await readData(database)).workspace!.profile!.name).toBe('Source');
  expect((await readData(database)).settings.goalKg).toBe(75);
});

it('keeps a correction made in Bodyweight when another profile field is edited', async () => {
  await saveProfile({ name: 'Sam', initialWeightKg: 70 }, 75, database);
  const profile = (await readData(database)).workspace!.profile!;
  await database.bodyweights.update(profile.initialWeightEntryId!, {
    kg: 71,
    notes: 'Corrected measurement',
  });
  await saveProfile({ ...profile, heightCm: 176 }, 75, database);
  expect(await database.bodyweights.get(profile.initialWeightEntryId!)).toMatchObject({
    kg: 71,
    notes: 'Corrected measurement',
  });
  await saveProfile({ ...profile, initialWeightKg: 72 }, 75, database);
  expect(await database.bodyweights.get(profile.initialWeightEntryId!)).toMatchObject({
    kg: 72,
    notes: 'Corrected measurement',
  });
});
