import { db } from './db';
import { BodyweightSchema, SettingsSchema, now, uid } from './model';
import { ProfileSchema, type UserProfile } from './profile-model';
import { defaultWorkspace, WorkspaceSchema } from './workspace-model';

export async function saveProfile(input: UserProfile, goalKg?: number, database = db) {
  const profile = ProfileSchema.parse({ ...input, onboarding: 'completed', updatedAt: now() });
  return database.transaction(
    'rw',
    [database.workspaces, database.bodyweights, database.settings],
    async () => {
      const workspace = (await database.workspaces.get('workspace')) ?? defaultWorkspace();
      const old = workspace.profile;
      // Keep a stable initial measurement identity; editing height never adds another weigh-in.
      const entryId = old?.initialWeightEntryId;
      const existing = entryId ? await database.bodyweights.get(entryId) : undefined;
      if (
        profile.initialWeightKg !== undefined &&
        profile.initialWeightKg !== old?.initialWeightKg
      ) {
        const entry = BodyweightSchema.parse({
          id: existing?.id ?? uid(),
          at: existing?.at ?? now(),
          kg: profile.initialWeightKg,
          notes: existing?.notes ?? 'Starting weight from your profile',
          tags: existing?.tags,
        });
        await database.bodyweights.put(entry);
        profile.initialWeightEntryId = entry.id;
      } else profile.initialWeightEntryId = entryId;
      const settings = await database.settings.get('preferences');
      await database.settings.put(SettingsSchema.parse({ ...settings, goalKg }));
      workspace.profile = profile;
      workspace.revision++;
      await database.workspaces.put(WorkspaceSchema.parse(workspace));
      return profile;
    },
  );
}
