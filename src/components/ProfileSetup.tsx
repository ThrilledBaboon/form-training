import { useState } from 'react';
import { useApp } from '../lib/context';
import { saveProfile } from '../lib/profile';
import { changeWorkspace } from '../lib/workspace';
import { fromKg, toKg, dateKey } from '../lib/calc';
import { Card, SectionTitle, Button, AsyncButton, Field } from './ui';

function ProfileForm({ welcome = false }: { welcome?: boolean }) {
  const { data, run, pending } = useApp();
  const profile = data.workspace?.profile;
  const unit = data.settings.unit;
  const initialKg =
    data.bodyweights.find((e) => e.id === profile?.initialWeightEntryId)?.kg ??
    profile?.initialWeightKg;
  const [name, setName] = useState(profile?.name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [height, setHeight] = useState(String(profile?.heightCm ?? ''));
  const [initial, setInitial] = useState(
    initialKg === undefined ? '' : String(Number(fromKg(initialKg, unit).toFixed(2))),
  );
  const [goal, setGoal] = useState(
    data.settings.goalKg === undefined
      ? ''
      : String(Number(fromKg(data.settings.goalKg, unit).toFixed(2))),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void run(
          () =>
            saveProfile(
              {
                ...profile,
                name,
                birthday: birthday || undefined,
                heightCm: height ? Number(height) : undefined,
                initialWeightKg: initial ? toKg(Number(initial), unit) : undefined,
              },
              goal ? toKg(Number(goal), unit) : undefined,
            ),
          'Profile saved',
        );
      }}
    >
      <p>All fields are optional. Saved on this device and included in your private backup.</p>
      <div className="form-grid">
        <Field label="Name (optional)">
          <input
            autoComplete="given-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Birthday (optional)">
          <input
            type="date"
            min="1900-01-01"
            max={dateKey(new Date())}
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </Field>
        <Field label="Height (cm)">
          <input
            type="number"
            min={50}
            max={300}
            step="any"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </Field>
        <Field
          label={`Starting weight (${unit})`}
          hint="Creates one starting weigh-in. Later profile edits do not add duplicates."
        >
          <input
            type="number"
            min={0.1}
            max={fromKg(1000, unit)}
            step="any"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
          />
        </Field>
        <Field label={`Goal weight (${unit})`}>
          <input
            type="number"
            min={0.1}
            max={fromKg(1000, unit)}
            step="any"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </Field>
      </div>
      <div className="food-actions">
        <Button type="submit" disabled={pending}>
          Save profile
        </Button>
        {welcome && (
          <AsyncButton
            type="button"
            variant="ghost"
            disabled={pending}
            onAction={() =>
              run(() =>
                changeWorkspace((w) => {
                  w.profile = { ...w.profile, name: w.profile?.name ?? '', onboarding: 'skipped' };
                }),
              )
            }
          >
            Skip for now
          </AsyncButton>
        )}
      </div>
    </form>
  );
}
export function ProfileSettings() {
  const { data } = useApp();
  return (
    <Card>
      <SectionTitle
        title="Your profile"
        sub="Your starting details and weight goal. Change them whenever you need."
      />
      <ProfileForm key={data.settings.unit} />
    </Card>
  );
}
export function ProfileWelcome() {
  const { data } = useApp();
  if (
    data.workspace?.profile?.onboarding ||
    data.sessions.length ||
    data.bodyweights.length ||
    data.food?.foodEntries.length ||
    data.food?.purchases.length ||
    data.food?.stock.length
  )
    return null;
  return (
    <Card className="profile-welcome">
      <SectionTitle
        title="Welcome to FORM"
        sub="Start with a few details, or skip and explore. You can edit these in Settings."
      />
      <ProfileForm key={data.settings.unit} welcome />
    </Card>
  );
}
