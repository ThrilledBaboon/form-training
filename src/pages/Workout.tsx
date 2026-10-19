import { previousExerciseSession, precedesSession } from '../lib/session-continuity';
import { WorkoutSetup } from './EquipmentSetups';
import { LinkButton as WorkspaceLink } from '../components/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Check,
  Copy,
  Trash2,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Play,
  Timer,
  Flag,
  ArrowLeft,
  Pencil,
  Dumbbell,
  Clock3,
  Layers,
  Activity,
  Weight,
} from 'lucide-react';
import { useApp, go } from '../lib/context';
import { db } from '../lib/db';
import {
  addExercise,
  substituteExercise,
  updateSet,
  completeSet,
  duplicateSet,
  updateSession,
  finishSession,
  deleteSession,
  applySuggestedTargets,
  startSession,
  saveSettings,
  updateSessionItem,
} from '../lib/actions';
import {
  uid,
  now,
  muscleName,
  type Session,
  type WorkoutSet,
  type Item,
  type Group,
} from '../lib/model';
import {
  recommendation,
  sessionStats,
  fmt,
  fromKg,
  toKg,
  dateLabel,
  dateKey,
  completedSessions,
  personalRecords,
  muscleContributions,
} from '../lib/calc';
import {
  PageTitle,
  Card,
  SectionTitle,
  Button,
  AsyncButton,
  Field,
  Modal,
  Empty,
  Badge,
  Numeric,
  LinkButton,
} from '../components/ui';
import { ExercisePicker, trackingLabel } from './Exercises';
import { BodyweightForm, localInput } from './Weight';
function SetRow({ set, item, index }: { set: WorkoutSet; item: Item; index: number }) {
  const { data, run, toast } = useApp();
  const [details, setDetails] = useState(false);
  const unit = data.settings.unit;
  const label = `${item.name} set ${index + 1}`;
  const patch = (p: Partial<WorkoutSet>) => void run(() => updateSet(set.id, p));
  return (
    <>
      {set.setup && (
        <small className="set-context">
          {set.setup.name} · {set.setup.basis.replaceAll('_', ' ')}
        </small>
      )}
      <div className={`set-row ${set.completed ? 'completed' : ''}`}>
        <span className="set-number">{set.label === 'warmup' ? 'W' : index + 1}</span>
        <select
          className="set-label"
          aria-label={`${label} type`}
          value={set.label}
          onChange={(e) => patch({ label: e.target.value as WorkoutSet['label'] })}
        >
          <option value="working">Working</option>
          <option value="warmup">Warm-up</option>
          <option value="failure">Failure</option>
          <option value="PR">PR attempt</option>
          <option value="custom">Custom</option>
        </select>
        {['weighted', 'loaded_bodyweight', 'assisted'].includes(item.tracking) ? (
          <Numeric
            compact
            label={`${label} ${item.tracking === 'assisted' ? 'assistance' : 'load'} (${unit})`}
            value={set.loadKg === undefined ? undefined : fromKg(set.loadKg, unit)}
            step={
              set.setup?.incrementKg
                ? fromKg(set.setup.incrementKg, unit)
                : data.settings.weightIncrement
            }
            onChange={(n) => patch({ loadKg: n === undefined ? undefined : toKg(n, unit) })}
          />
        ) : item.tracking === 'distance' ? (
          <Numeric
            compact
            label={`${label} distance (m)`}
            value={set.distanceM}
            step={100}
            onChange={(n) => patch({ distanceM: n })}
          />
        ) : item.tracking === 'duration' ? (
          <Numeric
            compact
            label={`${label} duration (s)`}
            value={set.durationSeconds}
            step={5}
            onChange={(n) => patch({ durationSeconds: n })}
          />
        ) : (
          <span className="bodyweight-label">Bodyweight</span>
        )}
        {['duration', 'distance'].includes(item.tracking) ? (
          item.tracking === 'distance' ? (
            <Numeric
              compact
              label={`${label} duration (s)`}
              value={set.durationSeconds}
              step={5}
              onChange={(n) => patch({ durationSeconds: n })}
            />
          ) : (
            <span className="muted set-unit">seconds</span>
          )
        ) : (
          <Numeric
            compact
            label={`${label} reps`}
            value={set.reps}
            step={data.settings.repIncrement}
            max={10000}
            onChange={(n) => patch({ reps: n })}
          />
        )}
        <AsyncButton
          variant={set.completed ? 'secondary' : 'ghost'}
          className="complete-set"
          aria-label={set.completed ? `Undo completion of ${label}` : `Complete ${label}`}
          aria-pressed={set.completed}
          onAction={() =>
            run(async () => {
              if (set.completed) {
                await updateSet(set.id, { completed: false, completedAt: undefined });
                toast('Set completion undone');
              } else {
                await completeSet(set.id);
              }
            })
          }
        >
          <Check size={19} />
        </AsyncButton>
        <Button
          variant="ghost"
          className="set-more"
          aria-label={`${label} details`}
          onClick={() => setDetails(true)}
        >
          <MoreHorizontal size={18} />
        </Button>
      </div>
      {details && (
        <Modal title={`Set ${index + 1} details`} onClose={() => setDetails(false)}>
          <p className="muted">
            Changes save immediately. {set.restUnknown ? 'Rest was not recorded.' : ''}
          </p>
          <Field label="Additional partial reps">
            <input
              type="number"
              min={0}
              max={10000}
              value={set.partialReps ?? ''}
              onChange={(e) =>
                patch({ partialReps: e.target.value === '' ? undefined : +e.target.value })
              }
            />
          </Field>
          <div className="form-grid">
            <Field label="Effort scale">
              <select
                value={set.rir !== undefined ? 'rir' : 'rpe'}
                onChange={(e) =>
                  patch(
                    e.target.value === 'rpe'
                      ? { rir: undefined, rpe: 0 }
                      : { rpe: undefined, rir: 0 },
                  )
                }
              >
                <option value="rpe">RPE (1–10)</option>
                <option value="rir">Reps in reserve (0–10)</option>
              </select>
            </Field>
            <Field label={set.rir !== undefined ? 'RIR (optional)' : 'RPE (optional)'}>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={set.rir ?? set.rpe ?? ''}
                onChange={(e) =>
                  patch(
                    set.rir !== undefined
                      ? { rir: e.target.value === '' ? undefined : +e.target.value }
                      : { rpe: e.target.value === '' ? undefined : +e.target.value },
                  )
                }
              />
            </Field>
            <Field label="Rest after set (seconds)">
              <input
                type="number"
                min={0}
                max={3600}
                value={set.restUnknown ? '' : set.restSeconds}
                onChange={(e) =>
                  patch({ restSeconds: +e.target.value, restUnknown: e.target.value === '' })
                }
              />
            </Field>
            {['bodyweight', 'loaded_bodyweight', 'assisted'].includes(item.tracking) && (
              <Field
                label={`Bodyweight for this set (${unit})`}
                hint={
                  item.includeBodyweight
                    ? 'Included in relative score, using this saved value.'
                    : 'Stored for reference; excluded from calculations.'
                }
              >
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step="any"
                  value={
                    set.bodyweightKg === undefined
                      ? ''
                      : Number(fromKg(set.bodyweightKg, unit).toFixed(3))
                  }
                  onChange={(e) =>
                    patch({
                      bodyweightKg: e.target.value === '' ? undefined : toKg(+e.target.value, unit),
                    })
                  }
                />
              </Field>
            )}
            <Field label="Set group (optional)">
              <select
                value={set.groupId || ''}
                onChange={(e) => patch({ groupId: e.target.value || undefined })}
              >
                <option value="">Use exercise group</option>
                {data.sessions
                  .find((s) => s.id === set.sessionId)
                  ?.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} · {g.type}
                    </option>
                  ))}
              </select>
            </Field>
            {set.label === 'custom' && (
              <Field label="Custom set label">
                <input
                  value={set.customLabel || ''}
                  onChange={(e) => patch({ customLabel: e.target.value })}
                />
              </Field>
            )}
          </div>
          <Field label="Set notes">
            <textarea value={set.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </Field>
          <div className="modal-actions">
            <AsyncButton
              variant="secondary"
              onAction={() =>
                run(async () => {
                  await duplicateSet(set);
                  setDetails(false);
                }, 'Set copied')
              }
            >
              <Copy size={16} />
              Duplicate set
            </AsyncButton>
            <AsyncButton
              variant="danger"
              onAction={() =>
                run(async () => {
                  await db.sets.delete(set.id);
                  setDetails(false);
                  toast('Set removed', () => db.sets.put(set));
                })
              }
            >
              <Trash2 size={16} />
              Delete set
            </AsyncButton>
          </div>
        </Modal>
      )}
    </>
  );
}
function WorkoutExercise({
  session,
  item,
  index,
}: {
  session: Session;
  item: Item;
  index: number;
}) {
  const { data, run, toast } = useApp();
  const [picking, setPicking] = useState(false);
  const sets = data.sets
    .filter((s) => s.sessionId === session.id && s.itemId === item.id)
    .sort((a, b) => a.order - b.order);
  const comparable = {
    ...data,
    sessions: data.sessions.filter((s) => precedesSession(s, session)),
    sets: data.sets.filter(
      (s) =>
        (s.setup?.id ?? '') === (item.setup?.id ?? '') &&
        (s.setup?.basis ?? 'unspecified') === (item.setup?.basis ?? 'unspecified'),
    ),
  };
  const previous = previousExerciseSession(data, session, item);
  const exercise = data.exercises.find((e) => e.id === item.exerciseId);
  const suggested = recommendation(comparable, item);
  const currentName = exercise?.name || item.name;
  const group = session.groups.find((g) => g.id === item.groupId);
  const patchItem = (p: Partial<Item>) => run(() => updateSessionItem(session.id, item.id, p));
  const move = (offset: number) => {
    const items = [...session.items];
    const next = index + offset;
    if (next < 0 || next >= items.length) return;
    [items[index], items[next]] = [items[next], items[index]];
    void run(() => updateSession(session.id, { items }));
  };
  const appendPrevious = async () => {
    if (!previous) return;
    await db.transaction('rw', db.sets, async () => {
      const max = Math.max(-1, ...sets.map((s) => s.order));
      await db.sets.bulkAdd(
        previous.sets.map((s, n) => ({
          ...s,
          id: uid(),
          sessionId: session.id,
          itemId: item.id,
          order: max + 1 + n,
          completed: false,
          completedAt: undefined,
          groupId: undefined,
          rpe: undefined,
          rir: undefined,
        })),
      );
    });
  };
  return (
    <Card className="workout-exercise">
      <div className="workout-exercise-heading">
        <span className="index-label">{String(index + 1).padStart(2, '0')}</span>
        <div>
          <h2>
            <a href={`#/progress?exercise=${item.exerciseId}`}>{currentName}</a>
          </h2>
          <p>
            {trackingLabel(item.tracking)} · {item.repMin}–{item.repMax} rep target{' '}
            {group && (
              <Badge>
                {group.name} · {group.type}
              </Badge>
            )}
          </p>
        </div>
        <div className="inline-actions">
          <Button
            variant="ghost"
            disabled={!index}
            aria-label={`Move ${currentName} up`}
            onClick={() => move(-1)}
          >
            <ChevronUp size={16} />
          </Button>
          <Button
            variant="ghost"
            disabled={index === session.items.length - 1}
            aria-label={`Move ${currentName} down`}
            onClick={() => move(1)}
          >
            <ChevronDown size={16} />
          </Button>
          <AsyncButton
            variant="ghost"
            aria-label={`Remove ${currentName} from session`}
            onAction={() =>
              run(async () => {
                if (!confirm('Remove this exercise and its sets from the workout?')) return;
                await db.transaction('rw', [db.sessions, db.sets], async () => {
                  await db.sets.where('itemId').equals(item.id).delete();
                  await updateSession(session.id, {
                    items: session.items.filter((i) => i.id !== item.id),
                  });
                });
                toast('Exercise removed', () =>
                  db.transaction('rw', [db.sessions, db.sets], async () => {
                    const latest = await db.sessions.get(session.id);
                    if (!latest) throw Error('Workout was removed.');
                    await db.sessions.update(session.id, { items: [...latest.items, item] });
                    await db.sets.bulkPut(sets);
                  }),
                );
              })
            }
          >
            <Trash2 size={16} />
          </AsyncButton>
        </div>
      </div>
      <WorkoutSetup sessionId={session.id} item={item} />
      <div className="previous-performance">
        <span>PREVIOUS</span>
        {previous ? (
          <p>
            {previous.sets
              .map((s) =>
                ['duration', 'distance'].includes(item.tracking)
                  ? `${s.distanceM ? `${fmt(s.distanceM)} m · ` : ''}${s.durationSeconds || 0}s`
                  : `${s.loadKg ? `${fmt(fromKg(s.loadKg, data.settings.unit))} ${data.settings.unit} × ` : ''}${s.reps} reps`,
              )
              .join('  /  ')}{' '}
            <small>· {dateLabel(previous.session.startAt)}</small>
          </p>
        ) : (
          <p>No completed session yet. This is your baseline.</p>
        )}
        {previous && (
          <AsyncButton
            variant="ghost"
            title="Append previous session as uncompleted sets"
            aria-label="Copy previous session"
            onAction={() => run(appendPrevious, 'Previous sets copied, ready to review')}
          >
            <Copy size={14} />
            <span>Copy</span>
          </AsyncButton>
        )}
      </div>
      {(exercise?.notes ||
        previous?.item.notes ||
        previous?.noteSets.some((s) => s.notes || s.partialReps)) && (
        <aside className="session-continuity" aria-label={currentName + ' session reminders'}>
          <strong>Session reminders</strong>
          {exercise?.notes && (
            <p className="preserve-lines">
              <strong>Library cue: </strong>
              {exercise.notes}
            </p>
          )}
          {previous && (
            <>
              <p className="small-text muted">
                From {previous.session.name} · {dateLabel(previous.session.startAt)} · same
                equipment and load convention
              </p>
              {previous.item.notes && (
                <p className="preserve-lines">
                  <strong>Exercise note: </strong>
                  {previous.item.notes}
                </p>
              )}
              {previous.noteSets
                .filter((s) => s.notes || s.partialReps)
                .map((s) => (
                  <p className="preserve-lines" key={s.id}>
                    <strong>
                      Set {s.order + 1}
                      {s.label === 'warmup' ? ' (warm-up)' : ''}:{' '}
                    </strong>
                    {s.notes}
                    {s.partialReps
                      ? `${s.notes ? ' · ' : ''}${s.partialReps} partial reps recorded separately`
                      : ''}
                  </p>
                ))}
              <a href={'#/history?session=' + previous.session.id}>Open previous session</a>
            </>
          )}
        </aside>
      )}
      <div className="set-table">
        <div className="set-table-head">
          <span>SET</span>
          <span>TYPE</span>
          <span>
            {item.tracking === 'assisted'
              ? `ASSIST (${data.settings.unit})`
              : item.tracking === 'distance'
                ? 'DISTANCE (M)'
                : item.tracking === 'duration'
                  ? 'TIME (S)'
                  : item.tracking === 'bodyweight'
                    ? 'LOAD'
                    : `LOAD (${data.settings.unit})`}
          </span>
          <span>
            {item.tracking === 'distance' ? 'TIME (S)' : item.tracking === 'duration' ? '' : 'REPS'}
          </span>
          <span>DONE</span>
          <span />
        </div>
        {sets.map((s, n) => (
          <SetRow key={s.id} set={s} item={item} index={n} />
        ))}
      </div>
      <div className="exercise-bottom-actions">
        <AsyncButton
          variant="ghost"
          onAction={() =>
            run(async () => {
              const last = sets[sets.length - 1];
              if (last) await duplicateSet(last);
              else
                await db.sets.add({
                  id: uid(),
                  sessionId: session.id,
                  itemId: item.id,
                  exerciseId: item.exerciseId,
                  order: 0,
                  reps: item.repMin,
                  loadKg: suggested.loadKg,
                  restSeconds: item.restSeconds,
                  restUnknown: item.restUnknown,
                  setup: item.setup,
                  label: 'working',
                  completed: false,
                  notes: '',
                });
            })
          }
        >
          <Plus size={15} />
          Add set
        </AsyncButton>
        <Button variant="ghost" onClick={() => setPicking(true)}>
          Substitute
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            void run(() =>
              db.timers.put({
                id: 'rest',
                endAt: Date.now() + item.restSeconds * 1000,
                durationMs: item.restSeconds * 1000,
                exerciseName: currentName,
                notified: false,
              }),
            )
          }
          disabled={!!item.restUnknown}
        >
          <Timer size={15} />
          {item.restUnknown ? 'Rest unknown; choose before timing' : item.restSeconds + 's rest'}
        </Button>
      </div>
      <details className="exercise-notes">
        <summary>Notes, groups & suggested targets</summary>
        <p className="suggestion">
          <strong>
            {suggested.increase ? 'Consider a small increase' : 'Next-session suggestion'} ·{' '}
          </strong>
          {suggested.loadKg > 0 &&
            `${fmt(fromKg(suggested.loadKg, data.settings.unit))} ${data.settings.unit} · `}
          {suggested.sets} × {suggested.reps} reps · {suggested.rest}s rest. {suggested.reason}
        </p>
        {session.status === 'active' &&
          previous &&
          !['duration', 'distance'].includes(item.tracking) &&
          sets.some((s) => !s.completed && s.label !== 'warmup') && (
            <AsyncButton
              variant="secondary"
              onAction={() =>
                run(
                  () => applySuggestedTargets(session.id, item.id),
                  'Suggested reps, load and rest applied to remaining working sets',
                )
              }
            >
              Use suggested targets
            </AsyncButton>
          )}
        <Field label="Workout-specific exercise notes">
          <textarea
            defaultValue={item.notes}
            placeholder="A cue, a change, a small win…"
            onChange={(e) => void patchItem({ notes: e.target.value })}
          />
        </Field>
        <Field label="Exercise group">
          <select
            value={item.groupId || ''}
            onChange={(e) => void patchItem({ groupId: e.target.value || undefined })}
          >
            <option value="">Individual exercise</option>
            {session.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · {g.type}
              </option>
            ))}
          </select>
        </Field>
        {group && (
          <p className="muted small-text">
            {group.notes} · Rest between exercises: {group.betweenSeconds ?? 0}s; after the last
            exercise in a round: {group.restSeconds}s. Log a round in exercise order.
          </p>
        )}
      </details>
      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(e) => {
            void run(async () => {
              await substituteExercise(session.id, item.id, e);
              setPicking(false);
            }, 'Exercise substituted');
          }}
        />
      )}
    </Card>
  );
}
export function SessionView({ session }: { session: Session }) {
  const { data, run, toast } = useApp();
  const [pick, setPick] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [editInfo, setEditInfo] = useState(false);
  const [dateOnly, setDateOnly] = useState(!!session.dateOnly);
  const [group, setGroup] = useState(false);
  const [bodyweight, setBodyweight] = useState(false);
  const active = session.status === 'active';
  const [, setClock] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setClock(Date.now()), 10000);
    return () => clearInterval(tick);
  }, [active]);
  const stats = sessionStats(data, session);
  const muscles = useMemo(
    () =>
      muscleContributions(
        {
          ...data,
          sessions: data.sessions.map((s) =>
            s.id === session.id ? { ...s, status: 'completed' as const } : s,
          ),
        },
        0,
      )
        .map((m) => ({ ...m, details: m.details.filter((d) => d.session.id === session.id) }))
        .filter((m) => m.details.length),
    [data, session],
  );
  const records = useMemo(
    () => personalRecords(data).filter((r) => r.sessionId === session.id),
    [data, session],
  );
  useEffect(() => {
    if (!active || !data.settings.keepAwake || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let disposed = false;
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible') {
          const l = await navigator.wakeLock.request('screen');
          if (disposed) await l.release();
          else lock = l;
        }
      } catch {
        /* Availability depends on browser and power state. */
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      void lock?.release();
      document.removeEventListener('visibilitychange', acquire);
    };
  }, [active, data.settings.keepAwake]);
  return (
    <>
      <PageTitle
        eyebrow={active ? 'IN YOUR ELEMENT' : 'YOUR EFFORT, RECORDED'}
        title={session.name}
        description={
          active
            ? 'Stay focused. Every change is saved as you go.'
            : `${dateLabel(session.startAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ${session.dateOnly ? '· Date only · times unrecorded ' : ''}· ${session.status === 'completed' ? 'Completed' : 'Kept as cancelled'}`
        }
        action={
          <div className="inline-actions">
            <Button variant="secondary" onClick={() => setEditInfo(true)}>
              <Pencil size={16} />
              Details
            </Button>
            {active && (
              <AsyncButton
                onAction={() =>
                  run(async () => {
                    await finishSession(session.id);
                    go('history?session=' + session.id);
                  }, 'Workout saved. Good work.')
                }
              >
                <Flag size={16} />
                Finish workout
              </AsyncButton>
            )}
          </div>
        }
      />
      <div className="session-summary-strip">
        <span>
          <Clock3 size={18} />
          {session.dateOnly ? (
            <strong>Duration unrecorded</strong>
          ) : (
            <>
              <strong>{fmt(stats.minutes, 0)}</strong> minutes
            </>
          )}
        </span>
        <span>
          <Layers size={18} />
          <strong>{stats.sets}</strong> working sets
        </span>
        <span>
          <Activity size={18} />
          <strong>{fmt(fromKg(stats.volume, data.settings.unit), 0)}</strong> {data.settings.unit}{' '}
          external volume
        </span>
        <select
          aria-label="Workout weight unit"
          value={data.settings.unit}
          onChange={(e) => void run(() => saveSettings({ unit: e.target.value as 'kg' | 'lb' }))}
        >
          <option value="kg">Kilograms</option>
          <option value="lb">Pounds</option>
        </select>
      </div>
      {!active && records.length > 0 && (
        <div className="record-banner">
          <span>↗</span>
          <div>
            <strong>
              {
                records.filter((r) =>
                  [
                    'Estimated 1RM',
                    'Heaviest load',
                    'Most reps in a set',
                    'Longest set',
                    'Furthest set',
                  ].includes(r.kind),
                ).length
              }{' '}
              current personal records belong to this session
            </strong>
            <p>
              Records recalculate whenever your history changes.{' '}
              <a href="#/records">Inspect your records →</a>
            </p>
          </div>
        </div>
      )}
      <div className="workout-layout">
        <div className="workout-main">
          {session.items.map((i, index) => (
            <WorkoutExercise key={i.id} session={session} item={i} index={index} />
          ))}
          {!session.items.length && (
            <Card>
              <Empty
                title="What are we training?"
                action={
                  <Button onClick={() => setPick(true)}>
                    <Plus size={16} />
                    Add your first exercise
                  </Button>
                }
              >
                Start with one exercise. Build your session as you go.
              </Empty>
            </Card>
          )}
          <Button
            variant="secondary"
            className="full-width add-exercise-button"
            onClick={() => setPick(true)}
          >
            <Plus size={18} />
            Add exercise
          </Button>
        </div>
        <aside className="workout-aside">
          <Card>
            <SectionTitle title="Session notes" sub="The context behind the numbers." />
            <textarea
              aria-label="Session notes"
              placeholder="How are you feeling today?"
              defaultValue={session.notes}
              rows={4}
              onChange={(e) => {
                const notes = e.target.value;
                void run(() => updateSession(session.id, { notes }));
              }}
            />
            <Button variant="ghost" onClick={() => setBodyweight(true)}>
              <Weight size={16} />
              Log bodyweight
            </Button>
          </Card>
          <Card>
            <SectionTitle
              title="Muscles in this session"
              sub="Completed sets · estimated contribution"
            />
            {muscles.length ? (
              <div className="muscle-session-list">
                {muscles.map((m) => (
                  <a href={`#/muscles?muscle=${m.muscle}`} key={m.muscle}>
                    <span>{muscleName(m.muscle)}</span>
                    <strong>{fmt(m.details.reduce((n, d) => n + d.contribution, 0))}</strong>
                  </a>
                ))}
              </div>
            ) : (
              <p className="muted">Complete a working set to see its muscle contributions.</p>
            )}
          </Card>
          <Card>
            <SectionTitle title="Session tools" />
            <Button variant="secondary" className="full-width" onClick={() => setGroup(true)}>
              <Layers size={16} />
              Add exercise group
            </Button>
            <p className="small-text muted">
              Supersets and circuits keep each set attached to its exercise. Assign exercises to
              your group in their notes panel.
            </p>
            {active ? (
              <Button variant="ghost" className="full-width" onClick={() => setCancel(true)}>
                Cancel workout
              </Button>
            ) : (
              <AsyncButton
                variant="danger"
                className="full-width"
                onAction={() =>
                  run(async () => {
                    if (!confirm('Delete this session and all its sets?')) return;
                    const undo = await deleteSession(session.id);
                    go('history');
                    toast('Session deleted', undo);
                  })
                }
              >
                <Trash2 size={16} />
                Delete session
              </AsyncButton>
            )}
          </Card>
        </aside>
      </div>
      {pick && (
        <ExercisePicker
          onClose={() => setPick(false)}
          onPick={(e) =>
            void run(async () => {
              await addExercise(session.id, e);
              setPick(false);
            })
          }
        />
      )}{' '}
      {bodyweight && <BodyweightForm onClose={() => setBodyweight(false)} />}
      {cancel && (
        <Modal title="Cancel this workout?" onClose={() => setCancel(false)}>
          <p>You can retain it as a cancelled session or discard it and its sets.</p>
          <div className="modal-actions">
            <AsyncButton
              variant="secondary"
              onAction={() =>
                run(async () => {
                  await updateSession(session.id, { status: 'cancelled', endAt: now() });
                  await db.timers.delete('rest');
                  go('history');
                })
              }
            >
              Keep as cancelled
            </AsyncButton>
            <AsyncButton
              variant="danger"
              onAction={() =>
                run(async () => {
                  const undo = await deleteSession(session.id);
                  go('today');
                  toast('Workout discarded', undo);
                })
              }
            >
              Discard workout
            </AsyncButton>
          </div>
        </Modal>
      )}
      {editInfo && (
        <Modal title="Workout details" onClose={() => setEditInfo(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void run(async () => {
                const startAt = new Date(
                  String(fd.get('start')) + (dateOnly ? 'T12:00:00' : ''),
                ).toISOString();
                const endAt = dateOnly
                  ? startAt
                  : fd.get('end')
                    ? new Date(String(fd.get('end'))).toISOString()
                    : undefined;
                if (endAt && endAt < startAt) throw Error('End time must follow start time.');
                await updateSession(session.id, {
                  name: String(fd.get('name')),
                  dateOnly,
                  startAt,
                  endAt,
                  rpe: fd.get('rpe') === '' ? undefined : Number(fd.get('rpe')),
                  energy: fd.get('energy') === '' ? undefined : Number(fd.get('energy')),
                });
                setEditInfo(false);
              }, 'Workout details updated');
            }}
          >
            <Field label="Workout name">
              <input name="name" required maxLength={150} defaultValue={session.name} />
            </Field>
            {!active && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={dateOnly}
                  onChange={(e) => setDateOnly(e.target.checked)}
                />
                Times unknown — date-only entry
              </label>
            )}
            <div className="form-grid">
              <Field label={dateOnly ? 'Workout date' : 'Start time'}>
                <input
                  name="start"
                  required
                  key={String(dateOnly)}
                  type={dateOnly ? 'date' : 'datetime-local'}
                  defaultValue={dateOnly ? dateKey(session.startAt) : localInput(session.startAt)}
                />
              </Field>
              {!active && !dateOnly && (
                <Field label="End time">
                  <input
                    name="end"
                    required
                    type="datetime-local"
                    defaultValue={localInput(session.endAt || session.startAt)}
                  />
                </Field>
              )}
              <Field label="Session RPE (optional)">
                <input
                  name="rpe"
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  defaultValue={session.rpe}
                />
              </Field>
              <Field label="Energy / fatigue (1–5)">
                <input name="energy" type="number" min={0} max={5} defaultValue={session.energy} />
              </Field>
            </div>
            <div className="modal-actions">
              <Button type="submit">Save details</Button>
            </div>
          </form>
        </Modal>
      )}
      {group && (
        <Modal title="Create exercise group" onClose={() => setGroup(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void run(async () => {
                await updateSession(session.id, {
                  groups: [
                    ...session.groups,
                    {
                      id: uid(),
                      name: String(fd.get('name')),
                      type: String(fd.get('type')) as Group['type'],
                      restSeconds: Number(fd.get('rest')),
                      betweenSeconds: Number(fd.get('between')),
                      notes: String(fd.get('notes')),
                    },
                  ],
                });
                setGroup(false);
              }, 'Group created');
            }}
          >
            <Field label="Group name">
              <input name="name" required maxLength={100} />
            </Field>
            <Field label="Group type">
              <select name="type">
                {['superset', 'triset', 'circuit', 'dropset', 'custom'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Rest after round (seconds)">
              <input name="rest" required type="number" min={0} max={3600} defaultValue={90} />
            </Field>
            <Field label="Rest between exercises / drop sets (seconds)">
              <input name="between" required type="number" min={0} max={3600} defaultValue={0} />
            </Field>
            <Field label="Group notes">
              <textarea name="notes" />
            </Field>
            <div className="modal-actions">
              <Button type="submit">Create group</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Workout() {
  const { data, run } = useApp();
  const active = data.sessions.find((s) => s.status === 'active');
  return active ? (
    <SessionView key={active.id} session={active} />
  ) : (
    <>
      <PageTitle
        title="Your next session awaits."
        description="Choose a routine or follow your own lead."
      />
      <Card>
        <Empty
          title="Ready when you are"
          action={
            <div className="inline-actions">
              <AsyncButton onAction={() => run(() => startSession())}>
                <Play size={16} />
                Start freestyle
              </AsyncButton>
              <Button variant="secondary" onClick={() => go('routines')}>
                Choose a routine
              </Button>
            </div>
          }
        >
          Your active workout will save here, even if you close the app.
        </Empty>
      </Card>
    </>
  );
}
export function History() {
  const { data, run } = useApp();
  const q = new URLSearchParams(location.hash.split('?')[1]);
  const id = q.get('session');
  const session = data.sessions.find((s) => s.id === id);
  const [search, setSearch] = useState('');
  const [since, setSince] = useState(q.get('from') ?? '');
  const [until, setUntil] = useState(q.get('to') ?? '');
  const [cancelled, setCancelled] = useState(false);
  if (session)
    return (
      <>
        <a className="back-link" href="#/history">
          <ArrowLeft size={15} />
          All workout history
        </a>
        <SessionView key={session.id} session={session} />
      </>
    );
  const sessions = data.sessions
    .filter(
      (s) =>
        (s.status === 'completed' || (cancelled && s.status === 'cancelled')) &&
        s.name.toLowerCase().includes(search.toLowerCase()) &&
        (!since || s.startAt >= new Date(since).toISOString()) &&
        (!until || s.startAt < new Date(new Date(until).getTime() + 86400000).toISOString()),
    )
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  return (
    <>
      <PageTitle
        eyebrow="A RECORD OF SHOWING UP"
        title="Workout history"
        description="Every session has a place in your story."
        action={
          <div className="inline-actions">
            <WorkspaceLink to="paste-workouts">Paste workout notes</WorkspaceLink>
            <AsyncButton
              onAction={() =>
                run(async () => {
                  await startSession();
                  go('workout');
                })
              }
            >
              <Plus size={17} />
              Add a workout
            </AsyncButton>
          </div>
        }
      />
      <Card className="filter-card">
        <input
          aria-label="Search workout history"
          placeholder="Search your sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Field label="From date">
          <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
        </Field>
        <Field label="To date">
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={cancelled}
            onChange={(e) => setCancelled(e.target.checked)}
          />
          Include cancelled
        </label>
      </Card>
      <p className="muted small-text">
        To add a historical workout, start a session, log its sets, then correct its start and end
        times in Details.
      </p>
      <Card>
        {sessions.length ? (
          <div className="session-list">
            {sessions.map((s) => {
              const stats = sessionStats(data, s);
              return (
                <a className="session-row" href={`#/history?session=${s.id}`} key={s.id}>
                  <span className="date-tile">
                    <small>{dateLabel(s.startAt, { month: 'short' })}</small>
                    <strong>{new Date(s.startAt).getDate()}</strong>
                  </span>
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {dateLabel(s.startAt, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      · {s.items.length} exercises · {stats.sets} sets
                    </small>
                  </span>
                  <span className="session-list-stats">
                    <strong>
                      {fmt(fromKg(stats.volume, data.settings.unit), 0)} {data.settings.unit}
                    </strong>
                    <small>
                      {s.dateOnly ? 'Duration unrecorded' : fmt(stats.minutes, 0) + ' min'} ·{' '}
                      {s.status}
                    </small>
                  </span>
                  <Pencil size={16} />
                </a>
              );
            })}
          </div>
        ) : (
          <Empty title="A blank page, with potential">
            Completed workouts will appear here. Your history will always be editable.
          </Empty>
        )}
      </Card>
    </>
  );
}
