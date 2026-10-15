import { useState } from 'react';
import {
  Plus,
  Play,
  Pencil,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  CalendarPlus,
  Layers,
  FolderPlus,
  Clock3,
} from 'lucide-react';
import { useApp, go } from '../lib/context';
import { db } from '../lib/db';
import { exerciseItem, saveRoutine, savePlan, startSession, reorderRoutines } from '../lib/actions';
import { uid, now, type Routine, type Item, type Group, type Plan } from '../lib/model';
import { fromKg, toKg, dateKey, dateLabel, fmt } from '../lib/calc';
import {
  PageTitle,
  Card,
  SectionTitle,
  Button,
  AsyncButton,
  Modal,
  Field,
  Badge,
  Empty,
} from '../components/ui';
import { ExercisePicker, trackingLabel } from './Exercises';
import { LibraryActions, ShareLibraryButton } from '../components/LibrarySharing';
const newRoutine = (): Routine => ({
  id: uid(),
  sortOrder: Date.now(),
  name: '',
  description: '',
  color: '#597e69',
  weekdays: [],
  items: [],
  groups: [],
  createdAt: now(),
  updatedAt: now(),
});
export function RoutineEditor({
  routine,
  onClose,
  onSave,
  title,
  scheduledDate,
  onDateChange,
}: {
  scheduledDate?: string;
  onDateChange?: (date: string) => void;
  routine?: Routine;
  onClose: () => void;
  onSave?: (r: Routine) => Promise<void>;
  title?: string;
}) {
  const { data, run } = useApp();
  const [r, setR] = useState<Routine>(routine ? structuredClone(routine) : newRoutine());
  const [pick, setPick] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<Group['type']>('superset');
  const patch = (p: Partial<Routine>) => setR({ ...r, ...p });
  const itemPatch = (id: string, p: Partial<Item>) =>
    patch({ items: r.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const move = (index: number, offset: number) => {
    const items = [...r.items];
    const next = index + offset;
    if (next < 0 || next >= items.length) return;
    [items[index], items[next]] = [items[next], items[index]];
    patch({ items });
  };
  return (
    <Modal title={title || (routine ? 'Edit routine' : 'Create a routine')} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!r.items.length) throw Error('Add at least one exercise.');
            if (r.items.some((i) => i.repMin > i.repMax))
              throw Error('A minimum rep target exceeds its maximum.');
            await (onSave ? onSave(r) : saveRoutine(r));
            onClose();
          }, 'Plan saved');
        }}
      >
        <div className="form-grid">
          {scheduledDate !== undefined && (
            <Field label="Scheduled date">
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => onDateChange?.(e.target.value)}
              />
            </Field>
          )}
          <Field label="Routine name">
            <input
              required
              maxLength={150}
              autoFocus
              value={r.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="Colour">
            <input
              type="color"
              value={r.color}
              onChange={(e) => patch({ color: e.target.value })}
            />
          </Field>
          <Field label="Programme">
            <select
              value={r.programmeId || ''}
              onChange={(e) => patch({ programmeId: e.target.value || undefined })}
            >
              <option value="">No programme</option>
              {data.programmes.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input value={r.description} onChange={(e) => patch({ description: e.target.value })} />
          </Field>
        </div>
        <fieldset className="weekdays">
          <legend>Weekly schedule (optional)</legend>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={r.weekdays.includes(i)}
                onChange={(e) =>
                  patch({
                    weekdays: e.target.checked
                      ? [...r.weekdays, i]
                      : r.weekdays.filter((d) => d !== i),
                  })
                }
              />
              <span>{day}</span>
            </label>
          ))}
        </fieldset>
        <SectionTitle
          title="Exercises & targets"
          sub="These are targets. Completed workouts keep their own snapshot."
          action={
            <Button type="button" variant="secondary" onClick={() => setPick(true)}>
              <Plus size={16} />
              Add exercise
            </Button>
          }
        />
        {r.items.map((item, index) => (
          <div className="routine-item-editor" key={item.id}>
            <div className="routine-item-heading">
              <span className="index-label">{String(index + 1).padStart(2, '0')}</span>
              <h3>{data.exercises.find((e) => e.id === item.exerciseId)?.name || item.name}</h3>
              <div className="inline-actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!index}
                  aria-label="Move exercise up"
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={index === r.items.length - 1}
                  aria-label="Move exercise down"
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Remove routine exercise"
                  onClick={() => {
                    if (confirm('Remove this exercise from the plan?'))
                      patch({ items: r.items.filter((i) => i.id !== item.id) });
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
            <div className="form-grid three">
              <Field label="Substitute exercise">
                <select
                  value={item.exerciseId}
                  onChange={(e) => {
                    const ex = data.exercises.find((x) => x.id === e.target.value)!;
                    itemPatch(item.id, {
                      exerciseId: ex.id,
                      name: ex.name,
                      tracking: ex.tracking,
                      includeBodyweight: ex.includeBodyweight,
                      sets: exerciseItem(ex).sets,
                    });
                  }}
                >
                  {data.exercises
                    .filter((e) => !e.archived || e.id === item.exerciseId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Rest per set (seconds)">
                <input
                  type="number"
                  min={0}
                  max={3600}
                  value={item.restSeconds}
                  onChange={(e) => itemPatch(item.id, { restSeconds: +e.target.value })}
                />
              </Field>
              <Field label="Group">
                <select
                  value={item.groupId || ''}
                  onChange={(e) => itemPatch(item.id, { groupId: e.target.value || undefined })}
                >
                  <option value="">Individual exercise</option>
                  {r.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} · {g.type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rep target min">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={item.repMin}
                  onChange={(e) => itemPatch(item.id, { repMin: +e.target.value })}
                />
              </Field>
              <Field label="Rep target max">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={item.repMax}
                  onChange={(e) => itemPatch(item.id, { repMax: +e.target.value })}
                />
              </Field>
              <Field label="Exercise notes">
                <input
                  value={item.notes}
                  onChange={(e) => itemPatch(item.id, { notes: e.target.value })}
                />
              </Field>
            </div>
            <div className="planned-sets">
              {item.sets.map((set, n) => (
                <div key={n}>
                  <span>Set {n + 1}</span>
                  <select
                    aria-label={`Set ${n + 1} label`}
                    value={set.label}
                    onChange={(e) =>
                      itemPatch(item.id, {
                        sets: item.sets.map((s, k) =>
                          k === n ? { ...s, label: e.target.value as typeof s.label } : s,
                        ),
                      })
                    }
                  >
                    <option value="working">Working</option>
                    <option value="warmup">Warm-up</option>
                    <option value="failure">Failure</option>
                    <option value="PR">PR attempt</option>
                    <option value="custom">Custom</option>
                  </select>
                  {['weighted', 'loaded_bodyweight', 'assisted'].includes(item.tracking) && (
                    <label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={`Set ${n + 1} target ${data.settings.unit}`}
                        value={
                          set.loadKg === undefined
                            ? ''
                            : Number(fromKg(set.loadKg, data.settings.unit).toFixed(3))
                        }
                        placeholder="Previous"
                        onChange={(e) =>
                          itemPatch(item.id, {
                            sets: item.sets.map((s, k) =>
                              k === n
                                ? {
                                    ...s,
                                    loadKg:
                                      e.target.value === ''
                                        ? undefined
                                        : toKg(+e.target.value, data.settings.unit),
                                  }
                                : s,
                            ),
                          })
                        }
                      />
                      <small>
                        {item.tracking === 'assisted' ? 'assist ' : ''}
                        {data.settings.unit}
                      </small>
                    </label>
                  )}
                  {!['duration', 'distance'].includes(item.tracking) && (
                    <label>
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        step="any"
                        aria-label={`Set ${n + 1} target reps`}
                        value={set.reps ?? ''}
                        onChange={(e) =>
                          itemPatch(item.id, {
                            sets: item.sets.map((s, k) =>
                              k === n ? { ...s, reps: +e.target.value } : s,
                            ),
                          })
                        }
                      />
                      <small>reps</small>
                    </label>
                  )}
                  {['duration', 'distance'].includes(item.tracking) && (
                    <label>
                      <input
                        type="number"
                        min={0}
                        aria-label={`Set ${n + 1} target seconds`}
                        value={set.durationSeconds ?? ''}
                        onChange={(e) =>
                          itemPatch(item.id, {
                            sets: item.sets.map((s, k) =>
                              k === n ? { ...s, durationSeconds: +e.target.value } : s,
                            ),
                          })
                        }
                      />
                      <small>sec</small>
                    </label>
                  )}
                  {item.tracking === 'distance' && (
                    <label>
                      <input
                        type="number"
                        min={0}
                        aria-label={`Set ${n + 1} target metres`}
                        value={set.distanceM ?? ''}
                        onChange={(e) =>
                          itemPatch(item.id, {
                            sets: item.sets.map((s, k) =>
                              k === n ? { ...s, distanceM: +e.target.value } : s,
                            ),
                          })
                        }
                      />
                      <small>m</small>
                    </label>
                  )}
                  <select
                    aria-label={`Set ${n + 1} group`}
                    value={set.groupId || ''}
                    onChange={(e) =>
                      itemPatch(item.id, {
                        sets: item.sets.map((s, k) =>
                          k === n ? { ...s, groupId: e.target.value || undefined } : s,
                        ),
                      })
                    }
                  >
                    <option value="">Exercise group</option>
                    {r.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remove planned set ${n + 1}`}
                    onClick={() =>
                      itemPatch(item.id, { sets: item.sets.filter((_, k) => k !== n) })
                    }
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                itemPatch(item.id, {
                  sets: [
                    ...item.sets,
                    {
                      ...(item.sets[item.sets.length - 1] || {
                        reps: item.repMin,
                        label: 'working',
                      }),
                    },
                  ],
                })
              }
            >
              <Plus size={15} />
              Add planned set
            </Button>
          </div>
        ))}
        {!r.items.length && (
          <Empty title="Give your session a structure" compact>
            Add exercises, then set your targets.
          </Empty>
        )}
        <h3 className="form-section-title">Supersets, circuits & groups</h3>
        {r.groups.map((g) => (
          <div key={g.id} className="group-editor">
            <Badge>{g.type}</Badge>
            <input
              aria-label="Group name"
              value={g.name}
              onChange={(e) =>
                patch({
                  groups: r.groups.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)),
                })
              }
            />
            <Field label="Round rest (s)">
              <input
                type="number"
                min={0}
                max={3600}
                value={g.restSeconds}
                onChange={(e) =>
                  patch({
                    groups: r.groups.map((x) =>
                      x.id === g.id ? { ...x, restSeconds: +e.target.value } : x,
                    ),
                  })
                }
              />
            </Field>
            <Field label="Between exercises (s)">
              <input
                type="number"
                min={0}
                max={3600}
                value={g.betweenSeconds ?? 0}
                onChange={(e) =>
                  patch({
                    groups: r.groups.map((x) =>
                      x.id === g.id ? { ...x, betweenSeconds: +e.target.value } : x,
                    ),
                  })
                }
              />
            </Field>
            <input
              aria-label="Group notes"
              placeholder="Group notes"
              value={g.notes}
              onChange={(e) =>
                patch({
                  groups: r.groups.map((x) =>
                    x.id === g.id ? { ...x, notes: e.target.value } : x,
                  ),
                })
              }
            />
            <Button
              variant="ghost"
              type="button"
              aria-label="Remove group"
              onClick={() =>
                patch({
                  groups: r.groups.filter((x) => x.id !== g.id),
                  items: r.items.map((i) => ({
                    ...i,
                    groupId: i.groupId === g.id ? undefined : i.groupId,
                    sets: i.sets.map((s) =>
                      s.groupId === g.id ? { ...s, groupId: undefined } : s,
                    ),
                  })),
                })
              }
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <div className="inline-form">
          <input
            aria-label="New group name"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <select
            aria-label="Group type"
            value={groupType}
            onChange={(e) => setGroupType(e.target.value as Group['type'])}
          >
            {['superset', 'triset', 'circuit', 'dropset', 'custom'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              patch({
                groups: [
                  ...r.groups,
                  {
                    id: uid(),
                    name: groupName.trim() || `Group ${r.groups.length + 1}`,
                    type: groupType,
                    restSeconds: 90,
                    notes: '',
                  },
                ],
              });
              setGroupName('');
            }}
          >
            <Plus size={15} />
            Add group
          </Button>
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save plan</Button>
        </div>
      </form>
      {pick && (
        <ExercisePicker
          onClose={() => setPick(false)}
          onPick={(e) => {
            patch({ items: [...r.items, exerciseItem(e)] });
            setPick(false);
          }}
        />
      )}
    </Modal>
  );
}
export function ScheduleForm({
  routine,
  onClose,
  date,
}: {
  routine: Routine;
  onClose: () => void;
  date?: string;
}) {
  const { run } = useApp();
  const [planId] = useState(uid());
  const [at, setAt] = useState(date || dateKey(new Date()));
  const [notes, setNotes] = useState('');
  return (
    <Modal title="Schedule a session" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await savePlan({
              id: planId,
              routineId: routine.id,
              name: routine.name,
              date: at,
              status: 'planned',
              items: structuredClone(routine.items),
              groups: structuredClone(routine.groups),
              notes,
            });
            onClose();
          }, 'Session scheduled');
        }}
      >
        <p>
          A copy of <strong>{routine.name}</strong> will be planned. Later routine edits will not
          change this session.
        </p>
        <Field label="Training date">
          <input required type="date" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>
        <Field label="Session notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <Button type="submit">Schedule session</Button>
        </div>
      </form>
    </Modal>
  );
}
export function Routines() {
  const { data, run, toast } = useApp();
  const query = new URLSearchParams(location.hash.split('?')[1]);
  const initial = query.get('routine');
  const [editor, setEditor] = useState<Routine | 'new' | null>(
    query.has('new') ? 'new' : initial ? data.routines.find((r) => r.id === initial) || null : null,
  );
  const [scheduled, setScheduled] = useState<Routine | null>(null);
  const [programme, setProgramme] = useState('');
  const [programmeModal, setProgrammeModal] = useState(false);
  const [planEdit, setPlanEdit] = useState<Plan | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="GO IN WITH A PLAN"
        title="Your training, by design."
        description="Build a rhythm you can come back to."
        action={
          <div className="inline-actions library-actions">
            <LibraryActions />
            <Button onClick={() => setEditor('new')}>
              <Plus size={17} />
              Create routine
            </Button>
          </div>
        }
      />
      <div className="toolbar routines-toolbar">
        <select
          aria-label="Filter programme"
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
        >
          <option value="">All programmes</option>
          {data.programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => setProgrammeModal(true)}>
          <FolderPlus size={16} />
          Programmes
        </Button>
      </div>
      <div className="routine-grid">
        {data.routines
          .filter((r) => !programme || r.programmeId === programme)
          .map((r, routineIndex) => (
            <Card className="routine-card" key={r.id}>
              <div className="routine-card-band" style={{ background: r.color }} />
              <div className="routine-card-content">
                <div className="routine-card-top">
                  <span
                    className="routine-large-icon"
                    style={{ color: r.color, background: r.color + '18' }}
                  >
                    <Layers size={25} />
                  </span>
                  <Badge>
                    {r.id.startsWith('starter')
                      ? 'STARTER TEMPLATE'
                      : data.programmes.find((p) => p.id === r.programmeId)?.name || 'YOUR ROUTINE'}
                  </Badge>
                </div>
                <h2>{r.name}</h2>
                <p>{r.description || 'A session built around your goals.'}</p>
                <div className="routine-numbers">
                  <span>{r.items.length} exercises</span>
                  <span>{r.items.reduce((n, i) => n + i.sets.length, 0)} sets</span>
                  <span>
                    <Clock3 size={13} />
                    {Math.round(
                      r.items.reduce((n, i) => n + i.sets.length * (45 + i.restSeconds), 0) / 60,
                    )}{' '}
                    min est.
                  </span>
                </div>
                <div className="routine-preview">
                  {r.items.slice(0, 4).map((i) => (
                    <div key={i.id}>
                      <span>
                        {data.exercises.find((e) => e.id === i.exerciseId)?.name || i.name}
                      </span>
                      <small>
                        {i.sets.length} × {i.repMin}–{i.repMax}
                      </small>
                    </div>
                  ))}
                  {r.items.length > 4 && <small>+ {r.items.length - 4} more exercises</small>}
                </div>
                {r.weekdays.length > 0 && (
                  <p className="small-text">
                    Weekly ·{' '}
                    {r.weekdays
                      .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                      .join(', ')}
                  </p>
                )}
                <AsyncButton
                  className="full-width"
                  onAction={() =>
                    run(async () => {
                      await startSession(r);
                      go('workout');
                    })
                  }
                >
                  <Play size={15} />
                  Start routine
                </AsyncButton>
                <div className="routine-order">
                  <AsyncButton
                    variant="ghost"
                    disabled={data.routines.indexOf(r) === 0}
                    aria-label={`Move routine ${r.name} up`}
                    onAction={() => run(() => reorderRoutines(r.id, -1))}
                  >
                    <ChevronUp size={15} />
                  </AsyncButton>
                  <AsyncButton
                    variant="ghost"
                    disabled={data.routines.indexOf(r) === data.routines.length - 1}
                    aria-label={`Move routine ${r.name} down`}
                    onAction={() => run(() => reorderRoutines(r.id, 1))}
                  >
                    <ChevronDown size={15} />
                  </AsyncButton>
                </div>
                <div className="card-actions">
                  <ShareLibraryButton
                    selection={{ kind: 'routine', id: r.id }}
                    label={`Share routine ${r.name}`}
                  />
                  <Button variant="ghost" onClick={() => setEditor(r)}>
                    <Pencil size={15} />
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => setScheduled(r)}>
                    <CalendarPlus size={16} />
                    Schedule
                  </Button>
                  <AsyncButton
                    variant="ghost"
                    aria-label={`Duplicate ${r.name}`}
                    onAction={() =>
                      run(
                        () =>
                          saveRoutine({
                            ...structuredClone(r),
                            id: uid(),
                            name: r.name + ' (copy)',
                            createdAt: now(),
                          }),
                        'Routine duplicated',
                      )
                    }
                  >
                    <Copy size={16} />
                  </AsyncButton>
                  <AsyncButton
                    variant="ghost"
                    aria-label={`Delete ${r.name}`}
                    onAction={() =>
                      run(async () => {
                        if (
                          !confirm(`Delete ${r.name}? Completed and planned workouts will be kept.`)
                        )
                          return;
                        await db.routines.delete(r.id);
                        toast('Routine deleted', () => db.routines.put(r));
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </AsyncButton>
                </div>
              </div>
            </Card>
          ))}
      </div>
      <Card>
        <SectionTitle
          title="Planned sessions"
          sub="A plan is a starting point. Adjust it whenever you need."
        />
        {data.plans.filter((p) => p.status === 'planned').length ? (
          <div className="session-list">
            {data.plans
              .filter((p) => p.status === 'planned')
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((p) => (
                <div className="session-row" key={p.id}>
                  <span className="date-tile">
                    <small>{dateLabel(p.date + 'T12:00:00', { month: 'short' })}</small>
                    <strong>{new Date(p.date + 'T12:00:00').getDate()}</strong>
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.items.length} exercises · planned</small>
                  </span>
                  <AsyncButton
                    variant="secondary"
                    onAction={() =>
                      run(async () => {
                        await startSession(p);
                        go('workout');
                      })
                    }
                  >
                    <Play size={15} />
                    Start
                  </AsyncButton>
                  <Button
                    variant="ghost"
                    aria-label="Edit planned session"
                    onClick={() => setPlanEdit(p)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <AsyncButton
                    variant="ghost"
                    aria-label="Delete planned session"
                    onAction={() =>
                      run(async () => {
                        if (confirm('Remove this planned session?')) {
                          await db.plans.delete(p.id);
                          toast('Plan removed', () => db.plans.put(p));
                        }
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </AsyncButton>
                </div>
              ))}
          </div>
        ) : (
          <Empty title="Make space for your next session" compact>
            Schedule a routine to see it here and on your calendar.
          </Empty>
        )}
      </Card>
      {editor && (
        <RoutineEditor
          routine={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}{' '}
      {scheduled && <ScheduleForm routine={scheduled} onClose={() => setScheduled(null)} />}{' '}
      {planEdit && (
        <RoutineEditor
          title="Edit planned session"
          scheduledDate={planEdit.date}
          onDateChange={(date) => setPlanEdit({ ...planEdit, date })}
          routine={{
            ...newRoutine(),
            id: planEdit.id,
            name: planEdit.name,
            description: planEdit.notes,
            items: planEdit.items,
            groups: planEdit.groups,
          }}
          onClose={() => setPlanEdit(null)}
          onSave={(r) =>
            savePlan({
              ...planEdit,
              name: r.name,
              notes: r.description,
              items: r.items,
              groups: r.groups,
            })
          }
        />
      )}
      {programmeModal && (
        <Modal title="Programmes" onClose={() => setProgrammeModal(false)}>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              void run(async () => {
                await db.programmes.add({
                  id: uid(),
                  name: String(fd.get('name')).trim(),
                  notes: String(fd.get('notes') || ''),
                });
                form.reset();
              }, 'Programme added');
            }}
          >
            <input
              name="name"
              required
              maxLength={150}
              aria-label="Programme name"
              placeholder="Programme name"
            />
            <input name="notes" aria-label="Programme notes" placeholder="Notes" />
            <Button type="submit">Add</Button>
          </form>
          {data.programmes.map((p) => (
            <div className="list-line" key={p.id}>
              <span>
                <strong>{p.name}</strong>
                <small>{p.notes}</small>
              </span>
              <ShareLibraryButton
                selection={{ kind: 'programme', id: p.id }}
                label={`Share programme ${p.name}`}
              />
              <Button
                variant="ghost"
                aria-label={`Rename ${p.name}`}
                onClick={() => {
                  const name = prompt('Programme name', p.name);
                  if (name?.trim())
                    void run(
                      () => db.programmes.update(p.id, { name: name.trim() }),
                      'Programme renamed',
                    );
                }}
              >
                <Pencil size={16} />
              </Button>
              <AsyncButton
                variant="ghost"
                aria-label={`Delete programme ${p.name}`}
                onAction={() =>
                  run(async () => {
                    if (!confirm('Delete this programme? Its routines will be kept.')) return;
                    await db.transaction('rw', [db.programmes, db.routines], async () => {
                      await db.programmes.delete(p.id);
                      await db.routines
                        .filter((r) => r.programmeId === p.id)
                        .modify({ programmeId: undefined });
                    });
                  }, 'Programme removed')
                }
              >
                <Trash2 size={16} />
              </AsyncButton>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
