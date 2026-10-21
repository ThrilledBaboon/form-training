import { useState } from 'react';
import {
  Plus,
  Search,
  Copy,
  Archive,
  ArrowUpRight,
  SlidersHorizontal,
  Dumbbell,
} from 'lucide-react';
import { useApp, go } from '../lib/context';
import { db } from '../lib/db';
import { saveExercise } from '../lib/actions';
import { LibraryActions, ShareLibraryButton } from '../components/LibrarySharing';
import {
  uid,
  now,
  MUSCLES,
  muscleName,
  trackingTypes,
  type Exercise,
  type Muscle,
  type Mapping,
} from '../lib/model';
import { Card, PageTitle, Button, AsyncButton, Modal, Field, Badge, Empty } from '../components/ui';
export const trackingLabel = (s: string) =>
  ({
    weighted: 'Weight + reps',
    bodyweight: 'Bodyweight reps',
    loaded_bodyweight: 'Bodyweight + load',
    assisted: 'Assisted reps',
    duration: 'Duration',
    distance: 'Distance + time',
  })[s] || s;
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (e: Exercise) => void;
  onClose: () => void;
}) {
  const { data } = useApp();
  const [search, setSearch] = useState('');
  return (
    <Modal title="Add an exercise" onClose={onClose}>
      <div className="search">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Find an exercise"
          placeholder="Search your exercise library…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="picker-list">
        {data.exercises
          .filter(
            (e) =>
              !e.archived &&
              (e.name + ' ' + e.aliases.join(' ')).toLowerCase().includes(search.toLowerCase()),
          )
          .map((e) => (
            <button key={e.id} onClick={() => onPick(e)}>
              <span className="exercise-icon">
                <Dumbbell size={18} />
              </span>
              <span>
                <strong>{e.name}</strong>
                <small>
                  {e.equipment} · {trackingLabel(e.tracking)}
                </small>
              </span>
              <Plus size={18} />
            </button>
          ))}
      </div>
    </Modal>
  );
}
export function ExerciseEditor({
  exercise,
  onClose,
}: {
  exercise?: Exercise;
  onClose: () => void;
}) {
  const { data, run } = useApp();
  const [e, setE] = useState<Exercise>(
    exercise || {
      id: uid(),
      name: '',
      aliases: [],
      equipment: 'Dumbbell',
      category: 'Strength',
      movement: 'Push',
      unilateral: false,
      tracking: 'weighted',
      restSeconds: data.settings.defaultRest,
      repMin: 8,
      repMax: 12,
      defaultSets: 3,
      notes: '',
      tags: [],
      archived: false,
      includeBodyweight: false,
      createdAt: now(),
      updatedAt: now(),
    },
  );
  const [maps, setMaps] = useState<Mapping[]>(
    exercise ? data.mappings.filter((m) => m.exerciseId === exercise.id) : [],
  );
  const patch = (p: Partial<Exercise>) => setE({ ...e, ...p });
  const muscleToggle = (muscle: Muscle, role: 'primary' | 'secondary' | 'none') =>
    setMaps([
      ...maps.filter((m) => m.muscle !== muscle),
      ...(role === 'none'
        ? []
        : [{ id: `${e.id}:${muscle}`, exerciseId: e.id, muscle, role, contribution: 1 }]),
    ]);
  return (
    <Modal title={exercise ? 'Edit exercise' : 'Create exercise'} onClose={onClose} wide>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void run(async () => {
            if (e.repMax < e.repMin) throw Error('Maximum reps must be at least the minimum.');
            await saveExercise(
              {
                ...e,
                aliases: e.aliases.map((x) => x.trim()).filter(Boolean),
                tags: e.tags.map((x) => x.trim()).filter(Boolean),
                updatedAt: now(),
              },
              maps,
            );
            onClose();
          }, 'Exercise saved');
        }}
      >
        <div className="form-grid">
          <Field label="Exercise name">
            <input
              required
              maxLength={150}
              value={e.name}
              onChange={(v) => patch({ name: v.target.value })}
            />
          </Field>
          <Field label="Equipment">
            <input
              required
              value={e.equipment}
              onChange={(v) => patch({ equipment: v.target.value })}
            />
          </Field>
          <Field label="Tracking type">
            <select
              value={e.tracking}
              onChange={(v) => patch({ tracking: v.target.value as Exercise['tracking'] })}
            >
              {trackingTypes.map((t) => (
                <option key={t} value={t}>
                  {trackingLabel(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <input value={e.category} onChange={(v) => patch({ category: v.target.value })} />
          </Field>
          <Field label="Movement pattern">
            <select value={e.movement} onChange={(v) => patch({ movement: v.target.value })}>
              {['Push', 'Pull', 'Squat', 'Hinge', 'Carry', 'Isolation / other'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Suggested-session role"
            hint="Mark compound movements explicitly so custom exercises can fill the full-body foundation. Auto recognises FORM’s starter movements."
          >
            <select
              value={e.suggestionRole ?? ''}
              onChange={(v) =>
                patch({
                  suggestionRole: (v.target.value || undefined) as Exercise['suggestionRole'],
                })
              }
            >
              <option value="">Auto / accessory for unknown movements</option>
              <option value="push">Compound push</option>
              <option value="pull">Compound pull</option>
              <option value="squat">Compound legs · squat / lunge</option>
              <option value="hinge">Compound legs · hinge</option>
              <option value="accessory">Accessory</option>
            </select>
          </Field>
          <Field label="Rest (seconds)">
            <input
              type="number"
              required
              min={0}
              max={3600}
              value={e.restSeconds}
              onChange={(v) => patch({ restSeconds: +v.target.value })}
            />
          </Field>
          <Field label="Default sets">
            <input
              type="number"
              required
              min={1}
              max={30}
              value={e.defaultSets}
              onChange={(v) => patch({ defaultSets: +v.target.value })}
            />
          </Field>
          <Field label="Target reps · minimum">
            <input
              type="number"
              required
              min={0}
              max={1000}
              value={e.repMin}
              onChange={(v) => patch({ repMin: +v.target.value })}
            />
          </Field>
          <Field label="Target reps · maximum">
            <input
              type="number"
              required
              min={0}
              max={1000}
              value={e.repMax}
              onChange={(v) => patch({ repMax: +v.target.value })}
            />
          </Field>
          <Field label="Alternative names (comma-separated)">
            <input
              value={e.aliases.join(',')}
              onChange={(v) => patch({ aliases: v.target.value.split(',') })}
            />
          </Field>
          <Field label="Tags (comma-separated)">
            <input
              value={e.tags.join(',')}
              onChange={(v) => patch({ tags: v.target.value.split(',') })}
            />
          </Field>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={e.unilateral}
            onChange={(v) => patch({ unilateral: v.target.checked })}
          />
          Unilateral exercise
        </label>
        {['bodyweight', 'loaded_bodyweight', 'assisted'].includes(e.tracking) && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={e.includeBodyweight}
              onChange={(v) => patch({ includeBodyweight: v.target.checked })}
            />
            Include a recorded bodyweight in relative contribution calculations
          </label>
        )}
        <Field label="Technique and personal notes">
          <textarea rows={3} value={e.notes} onChange={(v) => patch({ notes: v.target.value })} />
        </Field>
        <h3 className="form-section-title">Muscle contributions</h3>
        <p className="muted small-text">
          Map each muscle once. Primary and secondary weights are configurable in Settings. These
          are estimates.
        </p>
        <div className="mapping-grid">
          {MUSCLES.map((m) => (
            <label key={m}>
              <span>{muscleName(m)}</span>
              <select
                aria-label={`${muscleName(m)} contribution`}
                value={maps.find((x) => x.muscle === m)?.role || 'none'}
                onChange={(v) =>
                  muscleToggle(m, v.target.value as 'primary' | 'secondary' | 'none')
                }
              >
                <option value="none">—</option>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
              </select>
              {maps.some((x) => x.muscle === m) && (
                <input
                  aria-label={`${muscleName(m)} multiplier`}
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={maps.find((x) => x.muscle === m)!.contribution}
                  onChange={(v) =>
                    setMaps(
                      maps.map((x) =>
                        x.muscle === m ? { ...x, contribution: +v.target.value } : x,
                      ),
                    )
                  }
                />
              )}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save exercise</Button>
        </div>
      </form>
    </Modal>
  );
}
export function Exercises() {
  const { data, run, toast } = useApp();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [type, setType] = useState('');
  const [archived, setArchived] = useState(false);
  const [editor, setEditor] = useState<Exercise | 'new' | null>(null);
  const [tag, setTag] = useState('');
  const exercises = data.exercises
    .filter(
      (e) =>
        e.archived === archived &&
        (e.name + ' ' + e.aliases.join(' ')).toLowerCase().includes(search.toLowerCase()) &&
        (!equipment || e.equipment === equipment) &&
        (!type || e.tracking === type) &&
        (!tag || e.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))) &&
        (!muscle || data.mappings.some((m) => m.exerciseId === e.id && m.muscle === muscle)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageTitle
        eyebrow="BUILD YOUR TOOLKIT"
        title="Exercise library"
        description={`${data.exercises.filter((e) => !e.archived).length} exercises. Unlimited ways to make them yours.`}
        action={
          <div className="inline-actions library-actions">
            <LibraryActions />
            <Button variant="secondary" onClick={() => go('setups')}>
              Equipment setups
            </Button>
            <Button onClick={() => setEditor('new')}>
              <Plus size={17} />
              Create exercise
            </Button>
          </div>
        }
      />
      <Card className="filter-card">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Search exercises"
            placeholder="Find an exercise…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter muscle"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">All muscles</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {muscleName(m)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter equipment"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        >
          <option value="">All equipment</option>
          {[...new Set(data.exercises.map((e) => e.equipment))].sort().map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <select
          aria-label="Filter tracking type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All types</option>
          {trackingTypes.map((t) => (
            <option key={t} value={t}>
              {trackingLabel(t)}
            </option>
          ))}
        </select>
        <input
          aria-label="Filter exercise tags"
          placeholder="Filter tags"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <label className="check-label">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Archived
        </label>
      </Card>
      <div className="exercise-grid">
        {exercises.map((e) => (
          <Card key={e.id} className="exercise-card">
            <div className="exercise-card-top">
              <span className="exercise-icon">
                <Dumbbell size={21} />
              </span>
              <Badge>{e.equipment}</Badge>
            </div>
            <h3>{e.name}</h3>
            <p>
              {data.mappings
                .filter((m) => m.exerciseId === e.id && m.role === 'primary')
                .map((m) => muscleName(m.muscle))
                .join(' · ') || 'No muscle mapping yet'}
            </p>
            <div className="exercise-meta">
              <span>{trackingLabel(e.tracking)}</span>
              <span>{e.restSeconds}s rest</span>
            </div>
            <div className="card-actions">
              <ShareLibraryButton
                selection={{ kind: 'exercise', id: e.id }}
                label={`Share exercise ${e.name}`}
              />
              <Button variant="secondary" onClick={() => setEditor(e)}>
                Edit
              </Button>
              <a
                className="icon-button"
                aria-label={`View ${e.name} progress`}
                href={`#/progress?exercise=${e.id}`}
              >
                <ArrowUpRight size={17} />
              </a>
              <AsyncButton
                variant="ghost"
                aria-label={`Duplicate ${e.name}`}
                onAction={() =>
                  run(async () => {
                    const id = uid();
                    await saveExercise(
                      { ...e, id, name: e.name + ' (copy)', createdAt: now(), updatedAt: now() },
                      data.mappings
                        .filter((m) => m.exerciseId === e.id)
                        .map((m) => ({ ...m, id: id + ':' + m.muscle, exerciseId: id })),
                    );
                  }, 'Exercise duplicated')
                }
              >
                <Copy size={16} />
              </AsyncButton>
              <AsyncButton
                variant="ghost"
                aria-label={`${archived ? 'Restore' : 'Archive'} ${e.name}`}
                onAction={() =>
                  run(async () => {
                    if (
                      !archived &&
                      !confirm(
                        'Archive this exercise? Your history is preserved. It will be hidden from new-workout exercise lists.',
                      )
                    )
                      return;
                    await db.exercises.update(e.id, { archived: !archived, updatedAt: now() });
                    toast(archived ? 'Exercise restored' : 'Exercise archived', () =>
                      db.exercises.update(e.id, { archived }),
                    );
                  })
                }
              >
                <Archive size={16} />
              </AsyncButton>
            </div>
          </Card>
        ))}
      </div>
      {!exercises.length && (
        <Empty title="No exercises match">Adjust your filters or create your own exercise.</Empty>
      )}
      {editor && (
        <ExerciseEditor
          exercise={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
