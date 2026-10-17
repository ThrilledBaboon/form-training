import { useState } from 'react';
import { useApp } from '../lib/context';
import {
  defaultWorkspace,
  SetupSchema,
  SetupSnapshotSchema,
  type EquipmentSetup,
} from '../lib/workspace-model';
import { saveSetup, applyEquipmentSetup } from '../lib/workspace';
import { now, uid, type Item } from '../lib/model';
import { fromKg, toKg } from '../lib/calc';
import { db } from '../lib/db';
import { PageTitle, Card, Field, Button, AsyncButton, Modal, Empty, Badge } from '../components/ui';

export function EquipmentSetups() {
  const { data, run } = useApp();
  const [exercise, setExercise] = useState(
    new URLSearchParams(location.hash.split('?')[1]).get('exercise') ?? '',
  );
  const [archived, setArchived] = useState(false),
    [editing, setEditing] = useState<EquipmentSetup | 'new' | null>(null);
  const profiles = (data.workspace ?? defaultWorkspace()).setups.filter(
    (s) => (!exercise || s.exerciseId === exercise) && s.archived === archived,
  );
  return (
    <>
      <PageTitle
        title="Equipment setups"
        description="Remember the machine, adjustments and load convention you actually use."
        action={
          <Button disabled={!data.exercises.length} onClick={() => setEditing('new')}>
            Create setup
          </Button>
        }
      />
      <Card>
        <Field label="Filter setup exercise">
          <select value={exercise} onChange={(e) => setExercise(e.target.value)}>
            <option value="">All exercises</option>
            {data.exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Show archived setups
        </label>
      </Card>
      <div className="two-col">
        {profiles.map((s) => (
          <Card key={s.id}>
            <h2>{s.name}</h2>
            <p>
              {data.exercises.find((e) => e.id === s.exerciseId)?.name} ·{' '}
              {s.gym || 'No gym specified'}
            </p>
            {s.isDefault && <Badge>Default</Badge>}
            <p>{s.machine}</p>
            <p className="widget-note">{s.settings}</p>
            <p>{s.attachment}</p>
            <p>{s.notes}</p>
            <p className="muted">
              {s.basis.replaceAll('_', ' ')}
              {s.incrementKg
                ? ' · ' +
                  fromKg(s.incrementKg, data.settings.unit).toFixed(2) +
                  ' ' +
                  data.settings.unit +
                  ' increment'
                : ''}
            </p>
            <div className="food-actions">
              <Button variant="secondary" onClick={() => setEditing(s)}>
                Edit setup
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setEditing({
                    ...s,
                    id: uid(),
                    name: (s.name + ' copy').slice(0, 150),
                    isDefault: false,
                  })
                }
              >
                Duplicate
              </Button>
              <AsyncButton
                variant="ghost"
                onAction={() =>
                  run(
                    () =>
                      saveSetup({
                        ...s,
                        archived: !s.archived,
                        isDefault: false,
                        updatedAt: now(),
                      }),
                    s.archived ? 'Setup restored' : 'Setup archived; historical snapshots retained',
                  )
                }
              >
                {s.archived ? 'Restore' : 'Archive'}
              </AsyncButton>
            </div>
          </Card>
        ))}
      </div>
      {!profiles.length && (
        <Empty title="Save your first setup">
          A simple reminder is enough. Add machine positions, attachments and increments when
          useful.
        </Empty>
      )}
      {editing && (
        <SetupEditor
          initial={editing === 'new' ? undefined : editing}
          exerciseId={exercise}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function SetupEditor({
  initial,
  exerciseId,
  onClose,
}: {
  initial?: EquipmentSetup;
  exerciseId: string;
  onClose: () => void;
}) {
  const { data, run } = useApp();
  const [profile, setProfile] = useState<EquipmentSetup>(
    () =>
      initial ??
      SetupSchema.parse({
        id: uid(),
        exerciseId: exerciseId || data.exercises[0]?.id,
        name: 'My setup',
        updatedAt: now(),
      }),
  );
  const patch = (p: Partial<EquipmentSetup>) => setProfile({ ...profile, ...p });
  return (
    <Modal title={initial ? 'Edit equipment setup' : 'Create equipment setup'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await saveSetup({ ...profile, updatedAt: now() });
            onClose();
          }, 'Equipment setup saved');
        }}
      >
        <Field label="Setup name">
          <input
            required
            maxLength={150}
            value={profile.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="Setup exercise">
          <select
            required
            value={profile.exerciseId}
            onChange={(e) => patch({ exerciseId: e.target.value })}
          >
            {data.exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        {(['gym', 'machine', 'attachment'] as const).map((key) => (
          <Field
            key={key}
            label={
              key === 'gym'
                ? 'Gym / location'
                : key === 'machine'
                  ? 'Machine / equipment'
                  : 'Attachment / grip / stance'
            }
          >
            <input
              value={profile[key]}
              maxLength={key === 'attachment' ? 300 : 150}
              onChange={(e) => patch({ [key]: e.target.value })}
            />
          </Field>
        ))}
        <Field label="Machine settings">
          <textarea
            value={profile.settings}
            placeholder="Seat 3, backrest 2, pulley high…"
            onChange={(e) => patch({ settings: e.target.value })}
          />
        </Field>
        <Field label="How loads are entered">
          <select
            value={profile.basis}
            onChange={(e) => patch({ basis: e.target.value as EquipmentSetup['basis'] })}
          >
            <option value="unspecified">Unspecified / legacy convention</option>
            <option value="total">Total load</option>
            <option value="per_dumbbell">Per dumbbell</option>
            <option value="per_side">Per side</option>
          </select>
        </Field>
        <p className="small-text muted">
          This labels your recorded load. FORM does not double it or convert between different
          machines.
        </p>
        <Field label={'Available increment (' + data.settings.unit + ')'}>
          <input
            type="number"
            min="0.01"
            max={fromKg(100, data.settings.unit)}
            step="any"
            value={
              profile.incrementKg === undefined
                ? ''
                : Number(fromKg(profile.incrementKg, data.settings.unit).toFixed(4))
            }
            onChange={(e) =>
              patch({
                incrementKg: e.target.value ? toKg(+e.target.value, data.settings.unit) : undefined,
              })
            }
          />
        </Field>
        <Field label="Setup notes">
          <textarea value={profile.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={profile.isDefault}
            onChange={(e) => patch({ isDefault: e.target.checked })}
          />
          Use by default for future workouts of this exercise
        </label>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save setup</Button>
        </div>
      </form>
    </Modal>
  );
}
export function WorkoutSetup({ sessionId, item }: { sessionId: string; item: Item }) {
  const { data, run } = useApp();
  const profiles =
    data.workspace?.setups.filter((s) => s.exerciseId === item.exerciseId && !s.archived) ?? [];
  return (
    <div className="workout-setup">
      <Field label={'Equipment setup for ' + item.name}>
        <select
          value={item.setup?.id ?? ''}
          onChange={(e) =>
            void run(
              () => applyEquipmentSetup(sessionId, item.id, e.target.value),
              'Setup applied to uncompleted sets; completed snapshots retained',
            )
          }
        >
          <option value="">Unspecified setup</option>
          {item.setup && !profiles.some((s) => s.id === item.setup?.id) && (
            <option value={item.setup.id} disabled>
              {item.setup.name} · recorded setup (archived or changed)
            </option>
          )}
          {profiles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.gym ? ' · ' + s.gym : ''}
            </option>
          ))}
        </select>
      </Field>
      {item.setup && (
        <>
          <p>
            {item.setup.machine} {item.setup.settings} {item.setup.attachment}
          </p>
          <p>{item.setup.notes}</p>
          <small>
            Loads: {item.setup.basis.replaceAll('_', ' ')}. Earlier completed sets retain their own
            setup.
          </small>
        </>
      )}
      <a className="text-link" href={'#/setups?exercise=' + item.exerciseId}>
        Manage setups
      </a>
    </div>
  );
}
