import { db } from './db';
import { SettingsSchema } from './model';
import { PersonalisationSchema, type Personalisation } from './personalisation';
export async function savePersonalisation(
  value: Personalisation,
  expected: string | undefined,
  database = db,
) {
  const valid = PersonalisationSchema.parse(value);
  await database.transaction('rw', database.settings, async () => {
    const current = await database.settings.get('preferences');
    if (!current || JSON.stringify(current.personalisation) !== expected)
      throw Error('Your customisation changed in another tab. Reopen Settings before saving.');
    await database.settings.put(SettingsSchema.parse({ ...current, personalisation: valid }));
  });
}
