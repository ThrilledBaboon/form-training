import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/context';
import {
  WorkoutDraftSchema,
  ImportSessionSchema,
  ImportItemSchema,
  ImportSetSchema,
  parseWorkoutNotes,
  saveWorkoutImport,
  undoWorkoutImport,
  reviewedWorkoutKey,
  type WorkoutDraft,
  type ImportSet,
} from '../lib/workout-import';
import { changeWorkspace, moveEntry } from '../lib/workspace';
import { db } from '../lib/db';
import { uid, trackingTypes } from '../lib/model';
import { fromKg, toKg } from '../lib/calc';
import { PageTitle, Card, SectionTitle, Button, AsyncButton, Field, Empty } from '../components/ui';
import { localInput } from './Weight';
import { NoteRulesControls } from '../components/NoteRulesControls';
import { ImportPrompt } from '../components/ImportPrompt';
import { exportWorkoutFile, parseWorkoutFile } from '../lib/workout-file';
import { download } from '../lib/backup';

export function PasteWorkouts() {
  const { data, run, toast, pending } = useApp();
  const [draft, setDraft] = useState<WorkoutDraft>(() => {
    try {
      return WorkoutDraftSchema.parse(JSON.parse(data.workspace?.pasteDraft ?? ''));
    } catch {
      return { id: uid(), source: '', sessions: [], sourceEdited: false };
    }
  });
  const [mode, setMode] = useState<'history' | 'routines' | 'both'>('history'),
    [duplicate, setDuplicate] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const latest = useRef(draft);
  latest.current = draft;
  const saved = useRef(data.workspace?.pasteDraft);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    const text = JSON.stringify(draft);
    if (text === saved.current) return;
    setSaveStatus('Saving draft…');
    writes.current = writes.current
      .catch(() => {})
      .then(() =>
        changeWorkspace((w) => {
          w.pasteDraft = text;
        }),
      )
      .then(() => {
        saved.current = text;
        setSaveStatus('Draft saved on this device');
      });
    void writes.current.catch(() =>
      setSaveStatus('Could not save draft. Keep this screen open and try again.'),
    );
  }, [draft]);
  const [matches, setMatches] = useState<string[]>([]);
  useEffect(() => {
    let current = true;
    void Promise.all(draft.sessions.map(reviewedWorkoutKey)).then((keys) => {
      if (current)
        setMatches(
          draft.sessions
            .filter(
              (s, index) =>
                s.selected &&
                data.workspace?.imports.some(
                  (i) =>
                    i.workoutKeys?.includes(keys[index]) &&
                    ((mode !== 'routines' && i.sessionIds.length) ||
                      (mode !== 'history' && i.routineIds.length)),
                ),
            )
            .map((s) => s.name + ' · ' + s.date),
        );
    });
    return () => {
      current = false;
    };
  }, [draft.sessions, data.workspace?.imports, mode]);
  const patchSession = (index: number, patch: Partial<WorkoutDraft['sessions'][number]>) =>
    setDraft((current) => ({
      ...current,
      sessions: current.sessions.map((s, i) =>
        i === index ? { ...s, accepted: false, ...patch } : s,
      ),
    }));
  return (
    <>
      <PageTitle
        title="Paste workout notes"
        description="Turn your existing notes into reviewed history or unscheduled routines. Parsing runs on this device."
      />
      <Card>
        <NoteRulesControls />
        <Field label="Workout notes">
          <textarea
            rows={10}
            maxLength={100000}
            value={draft.source}
            placeholder={
              '13.10.26\nBench press 30 kg 3 x 8\nNote: could go heavier\nPull-ups 5 reps\n1. 1\n2. 2\n3. 3'
            }
            onChange={(e) =>
              setDraft({ ...draft, source: e.target.value, sourceEdited: !!draft.sessions.length })
            }
          />
        </Field>
        <p className="small-text muted">
          Standard rules use day-first dates (DD.MM.YY / DD.MM.YYYY) or ISO dates. Custom rules can
          change the format. Supports loads, reps, numbered sets, explicit overrides, rest and
          notes. This is a rules-based parser; review every result. Missing measurements stay blank.
        </p>
        <div className="food-actions">
          <Button
            onClick={() => {
              if (
                draft.sessions.length &&
                !confirm(
                  'Parse the source again? This replaces the reviewed draft, without changing saved workouts.',
                )
              )
                return;
              void run(async () => {
                setDraft(parseWorkoutNotes(draft.source, data, data.workspace?.noteRules));
              });
            }}
          >
            Parse notes
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (!confirm('Discard this import draft? Saved workouts are retained.')) return;
              setDraft({ id: uid(), source: '', sessions: [], sourceEdited: false });
            }}
          >
            Discard draft
          </Button>
          <span role="status">{saveStatus}</span>
        </div>
        <details className="food-section">
          <summary>Import or export workout JSON</summary>
          <p>
            Use a structured workout file for formats the note rules cannot express. Import opens an
            unconfirmed draft for review. Export includes the current draft’s workout notes and
            sets.
          </p>
          <div className="food-actions">
            <ImportPrompt kind="workouts" />
            <Button
              variant="secondary"
              disabled={!draft.sessions.length || draft.sourceEdited}
              onClick={() =>
                void run(async () => {
                  download(exportWorkoutFile(draft), 'form-workout-draft.json');
                })
              }
            >
              Export workout draft
            </Button>
            <label className="button secondary file-button">
              Import workout JSON
              <input
                type="file"
                accept=".json,application/json"
                aria-label="Import workout JSON"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file)
                    void run(async () => {
                      if (file.size > 1000000)
                        throw Error('Workout JSON must be smaller than 1 MB.');
                      const incoming = parseWorkoutFile(await file.text(), data);
                      if (
                        (draft.sessions.length || draft.source.trim()) &&
                        !confirm('Replace this import draft? Saved workouts are retained.')
                      )
                        return;
                      setDraft(incoming);
                    });
                }}
              />
            </label>
          </div>
        </details>
      </Card>
      {draft.sourceEdited && (
        <p className="callout">The source text changed. Parse it again before saving the review.</p>
      )}
      {draft.sessions.map((session, si) => (
        <Card key={si}>
          <SectionTitle
            title={'Workout ' + (si + 1)}
            sub={session.items.length + ' exercises to review'}
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={session.selected}
              onChange={(e) => patchSession(si, { selected: e.target.checked })}
            />
            Include this workout
          </label>
          <div className="two-col">
            <Field label="Workout name">
              <input
                required
                maxLength={150}
                value={session.name}
                onChange={(e) => patchSession(si, { name: e.target.value })}
              />
            </Field>
            <Field label="Workout date">
              <input
                required
                type="date"
                value={session.date}
                onChange={(e) => patchSession(si, { date: e.target.value })}
              />
            </Field>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={session.dateOnly}
              onChange={(e) => patchSession(si, { dateOnly: e.target.checked })}
            />
            Times unknown — date-only entry, no recorded duration
          </label>
          {!session.dateOnly && (
            <div className="two-col">
              {(['startAt', 'endAt'] as const).map((k) => (
                <Field key={k} label={k === 'startAt' ? 'Actual start time' : 'Actual finish time'}>
                  <input
                    type="datetime-local"
                    value={session[k] ? localInput(session[k]!) : ''}
                    onChange={(e) =>
                      patchSession(si, {
                        [k]: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          )}
          <Field label="Workout notes">
            <textarea
              value={session.notes}
              onChange={(e) => patchSession(si, { notes: e.target.value })}
            />
          </Field>
          {session.warnings.length > 0 && (
            <details open>
              <summary>Parser observations — review before accepting</summary>
              <ul>
                {session.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="food-actions">
            <Button
              variant="ghost"
              onClick={() => {
                if (!confirm('Remove this workout from the import draft?')) return;
                setDraft({ ...draft, sessions: draft.sessions.filter((_, i) => i !== si) });
              }}
            >
              Remove draft workout
            </Button>
            {si > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  const previous = draft.sessions[si - 1];
                  if (
                    previous.date !== session.date &&
                    !confirm(
                      'Merge workouts with different dates? Review the earlier workout date after merging.',
                    )
                  )
                    return;
                  setDraft({
                    ...draft,
                    sessions: draft.sessions.flatMap((s, index) =>
                      index === si
                        ? []
                        : index === si - 1
                          ? [
                              {
                                ...previous,
                                accepted: false,
                                items: [...previous.items, ...session.items],
                                notes: [previous.notes, session.notes].filter(Boolean).join('\n'),
                              },
                            ]
                          : [s],
                    ),
                  });
                }}
              >
                Merge into previous workout
              </Button>
            )}
          </div>
          {session.items.map((item, ii) => {
            const patchItem = (p: Partial<typeof item>) =>
              patchSession(si, {
                items: session.items.map((old, index) => (index === ii ? { ...old, ...p } : old)),
              });
            const patchSet = (index: number, p: Partial<ImportSet>) =>
              patchItem({ sets: item.sets.map((s, i) => (i === index ? { ...s, ...p } : s)) });
            const numeric = (
              set: ImportSet,
              index: number,
              key:
                'reps' | 'loadKg' | 'partialReps' | 'restSeconds' | 'durationSeconds' | 'distanceM',
              label: string,
            ) => (
              <Field label={label}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={
                    set[key] === undefined
                      ? ''
                      : key === 'loadKg'
                        ? Number(fromKg(set[key]!, data.settings.unit).toFixed(4))
                        : set[key]
                  }
                  onChange={(e) =>
                    patchSet(index, {
                      [key]:
                        e.target.value === ''
                          ? undefined
                          : key === 'loadKg'
                            ? toKg(+e.target.value, data.settings.unit)
                            : +e.target.value,
                    })
                  }
                />
              </Field>
            );
            return (
              <details
                className="import-exercise"
                open={session.items.length < 4 || !item.exerciseId}
                key={ii}
              >
                <summary>
                  {ii + 1}. {item.name} · {item.sets.length} sets
                  {!item.exerciseId && !item.create ? ' · match needed' : ''}
                </summary>
                <div className="two-col">
                  <Field label="Match exercise">
                    <select
                      value={item.create ? '__create__' : (item.exerciseId ?? '')}
                      onChange={(e) => {
                        const ex = data.exercises.find((ex) => ex.id === e.target.value);
                        patchItem({
                          exerciseId: ex?.id,
                          create: e.target.value === '__create__',
                          tracking: ex?.tracking ?? item.tracking,
                        });
                      }}
                    >
                      <option value="">Choose an exercise</option>
                      <option value="__create__">Create a new exercise explicitly</option>
                      {data.exercises.map((ex) => (
                        <option value={ex.id} key={ex.id}>
                          {ex.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Imported exercise name">
                    <input
                      value={item.name}
                      maxLength={150}
                      onChange={(e) => patchItem({ name: e.target.value })}
                    />
                  </Field>
                  <Field label="Imported tracking type">
                    <select
                      value={item.tracking}
                      onChange={(e) =>
                        patchItem({ tracking: e.target.value as typeof item.tracking })
                      }
                    >
                      {trackingTypes.map((t) => (
                        <option key={t} value={t}>
                          {t.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Recorded load convention">
                    <select
                      value={item.basis}
                      disabled={!!item.setupId}
                      onChange={(e) => patchItem({ basis: e.target.value as typeof item.basis })}
                    >
                      {['unspecified', 'total', 'per_dumbbell', 'per_side'].map((b) => (
                        <option key={b} value={b}>
                          {b.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Imported equipment context">
                    <select
                      value={item.setupId ?? ''}
                      onChange={(e) => patchItem({ setupId: e.target.value || undefined })}
                    >
                      <option value="">No saved setup</option>
                      {data.workspace?.setups
                        .filter((s) => s.exerciseId === item.exerciseId && !s.archived)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <Field label="Exercise notes">
                  <textarea
                    value={item.notes}
                    onChange={(e) => patchItem({ notes: e.target.value })}
                  />
                </Field>
                <div className="food-actions">
                  <Button
                    variant="ghost"
                    disabled={ii === 0}
                    onClick={() =>
                      patchSession(si, { items: moveEntry(session.items, ii, ii - 1) })
                    }
                  >
                    Move exercise up
                  </Button>
                  {ii > 0 && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          sessions: draft.sessions.flatMap((s, index) =>
                            index === si
                              ? [
                                  {
                                    ...session,
                                    accepted: false,
                                    items: session.items.slice(0, ii),
                                  },
                                  {
                                    ...session,
                                    name: (session.name + ' part 2').slice(0, 150),
                                    accepted: false,
                                    items: session.items.slice(ii),
                                  },
                                ]
                              : [s],
                          ),
                        })
                      }
                    >
                      Split workout before this exercise
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    disabled={ii === session.items.length - 1}
                    onClick={() =>
                      patchSession(si, { items: moveEntry(session.items, ii, ii + 1) })
                    }
                  >
                    Move exercise down
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      patchSession(si, { items: session.items.filter((_, i) => i !== ii) })
                    }
                  >
                    Remove exercise
                  </Button>
                </div>
                {item.sets.map((set, index) => (
                  <div className="import-set" key={index}>
                    <h4>Set {index + 1}</h4>
                    <div className="import-set-fields">
                      {!['duration', 'distance'].includes(item.tracking) &&
                        numeric(set, index, 'reps', 'Full reps')}
                      {['weighted', 'loaded_bodyweight', 'assisted'].includes(item.tracking) &&
                        numeric(set, index, 'loadKg', 'Recorded load (' + data.settings.unit + ')')}
                      {numeric(set, index, 'partialReps', 'Additional partial reps')}
                      {['duration', 'distance'].includes(item.tracking) &&
                        numeric(set, index, 'durationSeconds', 'Duration (seconds)')}
                      {item.tracking === 'distance' &&
                        numeric(set, index, 'distanceM', 'Distance (metres)')}
                      {numeric(set, index, 'restSeconds', 'Rest (seconds; blank is unknown)')}
                      <Field label="Set label">
                        <select
                          value={set.label}
                          onChange={(e) =>
                            patchSet(index, { label: e.target.value as ImportSet['label'] })
                          }
                        >
                          {['working', 'warmup', 'failure', 'PR', 'custom'].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Set notes">
                      <textarea
                        value={set.notes}
                        onChange={(e) => patchSet(index, { notes: e.target.value })}
                      />
                    </Field>
                    <div className="food-actions">
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={set.completed}
                          onChange={(e) => patchSet(index, { completed: e.target.checked })}
                        />
                        Actually completed (uncheck if measurements are unknown)
                      </label>
                      <Button
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => patchItem({ sets: moveEntry(item.sets, index, index - 1) })}
                      >
                        Move set up
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => patchItem({ sets: item.sets.filter((_, i) => i !== index) })}
                      >
                        Remove set
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() => patchItem({ sets: [...item.sets, ImportSetSchema.parse({})] })}
                >
                  Add reviewed set
                </Button>
              </details>
            );
          })}
          <div className="food-actions">
            <Button
              variant="secondary"
              onClick={() =>
                patchSession(si, {
                  items: [
                    ...session.items,
                    ImportItemSchema.parse({
                      name: 'New exercise',
                      sets: [ImportSetSchema.parse({})],
                    }),
                  ],
                })
              }
            >
              Add reviewed exercise
            </Button>
          </div>
          <label className="check-label import-accept">
            <input
              type="checkbox"
              checked={session.accepted}
              onChange={(e) => patchSession(si, { accepted: e.target.checked })}
            />
            I reviewed this workout, including unknown values, date, load conventions and partial
            reps.
          </label>
        </Card>
      ))}
      {!!draft.sessions.length && (
        <Card>
          {matches.length > 0 && (
            <div className="callout">
              <strong>Previously imported workouts match this review:</strong>
              <ul>
                {matches.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
              <p>Keep the existing records, or deliberately allow another copy below.</p>
            </div>
          )}
          <Field label="Save reviewed workouts as">
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="history">Completed historical sessions</option>
              <option value="routines">Unscheduled reusable routines</option>
              <option value="both">Both history and routines</option>
            </select>
          </Field>
          <label className="check-label">
            <input
              type="checkbox"
              checked={duplicate}
              onChange={(e) => setDuplicate(e.target.checked)}
            />
            Deliberately allow an additional copy of previously imported content
          </label>
          <p>
            {draft.sessions.filter((s) => s.selected).length} selected workouts. Only reviewed
            records are saved. This does not start a workout or timer.
          </p>
          <AsyncButton
            disabled={pending || draft.sourceEdited}
            onAction={() =>
              run(async () => {
                await writes.current;
                const result = await saveWorkoutImport(latest.current, mode, duplicate);
                const workspace = await db.workspaces.get('workspace');
                const next = workspace?.pasteDraft
                  ? WorkoutDraftSchema.parse(JSON.parse(workspace.pasteDraft))
                  : { id: uid(), source: '', sessions: [], sourceEdited: false };
                saved.current = JSON.stringify(next);
                setDraft(next);
                toast(
                  `Saved ${result.sessionIds.length} sessions and ${result.routineIds.length} routines`,
                  () => undoWorkoutImport(result.id),
                );
              })
            }
          >
            Save reviewed workouts
          </AsyncButton>
        </Card>
      )}
      {!draft.sessions.length && (
        <Empty title="Your notes, structured for review">
          Paste one or several workouts, parse them, then correct the interpretation before saving.
        </Empty>
      )}
      <Button
        variant="secondary"
        onClick={() =>
          setDraft({
            ...draft,
            sessions: [
              ...draft.sessions,
              ImportSessionSchema.parse({ name: 'Imported workout', items: [] }),
            ],
          })
        }
      >
        Add workout manually to review
      </Button>
    </>
  );
}
