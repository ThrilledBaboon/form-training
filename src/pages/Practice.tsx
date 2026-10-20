import { useEffect, useState } from 'react';
import { useApp, go } from '../lib/context';
import { uid } from '../lib/model';
import {
  Card,
  PageTitle,
  SectionTitle,
  Button,
  AsyncButton,
  Field,
  Modal,
  Empty,
} from '../components/ui';
import { download } from '../lib/backup';
import {
  DrillSchema,
  PracticeRoutineSchema,
  practiceData,
  practiceName,
  timerSeconds,
  type PracticeSystem,
  type PracticeDrill,
  type PracticeRoutine,
  type PracticeData,
  type PracticeResult,
  type PracticeEntry,
  type PracticeSession,
} from '../lib/practice-model';
import {
  changePractice,
  savePracticeLibrary,
  startPractice,
  practiceCommand,
  deletePracticeSession,
  type PracticeCommand,
} from '../lib/practice-actions';
import {
  freshDrill,
  addPracticeStarters,
  parsePracticeLibrary,
  sharePractice,
  importPracticeLibrary,
  type PracticeLibrary,
} from '../lib/practice-library';
import { PracticeProgress, PracticeBalance, PracticeWeek } from '../components/PracticeWidgets';
const metrics = {
  time: 'Timed practice',
  accuracy: 'Hits / attempts',
  streak: 'Best consecutive streak',
  course: 'Course time (seconds)',
};
export const clockText = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function Practice({
  system,
  view,
}: {
  system: PracticeSystem;
  view: 'library' | 'session' | 'history';
}) {
  const { data } = useApp();
  const p = practiceData(data, system);
  return (
    <div className="practice-stack">
      <PageTitle
        eyebrow={practiceName(system)}
        title={
          view === 'library'
            ? 'Drills & routines'
            : view === 'history'
              ? 'Practice history'
              : 'Practice'
        }
        description={
          view === 'session'
            ? 'Follow your routine at your own pace. Counts and results are optional.'
            : undefined
        }
      />
      <nav className="practice-nav" aria-label={practiceName(system) + ' navigation'}>
        {(['home', 'library', 'session', 'history'] as const).map((v) => (
          <a key={v} href={'#/' + system + '-' + v} aria-current={v === view ? 'page' : undefined}>
            {
              {
                home: 'Overview',
                library: 'Drills & routines',
                session: 'Practice',
                history: 'History',
              }[v]
            }
          </a>
        ))}
      </nav>
      {view === 'library' ? (
        <Library key={system} p={p} />
      ) : view === 'session' ? (
        <SessionView key={system} p={p} />
      ) : (
        <PracticeHistory key={system} p={p} />
      )}
    </div>
  );
}
export function PracticeStart({ p }: { p: PracticeData }) {
  const { run } = useApp();
  const active = p.sessions.find((s) => s.status === 'active');
  if (active)
    return (
      <>
        <p>{active.name} · saved in progress</p>
        <a className="button primary" href={'#/' + p.id + '-session'}>
          Resume practice
        </a>
      </>
    );
  return (
    <>
      {!p.routines.length && <p>Create a routine or add editable starter warm-ups.</p>}
      <div className="practice-list">
        {p.routines.map((r) => (
          <div className="practice-row" key={r.id}>
            <div>
              <strong>{r.name}</strong>
              <small className="muted"> · {r.blocks.reduce((n, b) => n + b.sets, 0)} sets</small>
            </div>
            <AsyncButton
              onAction={async () => {
                if (await run(() => startPractice(p.id, r.id))) go(p.id + '-session');
              }}
            >
              Start {r.name}
            </AsyncButton>
          </div>
        ))}
      </div>
      <a className="button secondary" href={'#/' + p.id + '-library'}>
        Manage drills & routines
      </a>
    </>
  );
}
function Library({ p }: { p: PracticeData }) {
  const { run, toast } = useApp();
  const [drill, setDrill] = useState<PracticeDrill>();
  const [routine, setRoutine] = useState<PracticeRoutine>();
  const [expected, setExpected] = useState(p.revision);
  const [incoming, setIncoming] = useState<PracticeLibrary>();
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('');
  const [space, setSpace] = useState('');
  const [solo, setSolo] = useState(false);
  const [settings, setSettings] = useState(false);
  const saveLibrary = (
    patch: Partial<Pick<PracticeData, 'drills' | 'routines' | 'goal' | 'focus'>>,
  ) =>
    savePracticeLibrary(
      p.id,
      { drills: p.drills, routines: p.routines, goal: p.goal, focus: p.focus, ...patch },
      expected,
    );
  return (
    <>
      <Card>
        <SectionTitle
          title="Your routines"
          action={
            <Button
              onClick={() => {
                setExpected(p.revision);
                setRoutine(
                  PracticeRoutineSchema.parse({
                    id: uid(),
                    name: 'New routine',
                    blocks: [
                      {
                        id: uid(),
                        drillId: p.drills.find((d) => !d.archived)?.id ?? '',
                        sets: 1,
                        seconds: 180,
                      },
                    ],
                  }),
                );
              }}
              disabled={!p.drills.some((d) => !d.archived)}
            >
              New routine
            </Button>
          }
        />
        {!p.routines.length && <p>Add drills below, or use the starter templates.</p>}
        {p.routines.map((r) => (
          <div className="practice-row" key={r.id}>
            <div>
              <h3>{r.name}</h3>
              <p className="muted">
                {r.blocks.length} blocks · {r.notes}
              </p>
            </div>
            <div className="inline-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setExpected(p.revision);
                  setRoutine(structuredClone(r));
                }}
              >
                Edit {r.name}
              </Button>
              <Button
                variant="secondary"
                onClick={() => download(sharePractice(p, [r.id]), 'form-' + p.id + '-routine.json')}
              >
                Share {r.name}
              </Button>
            </div>
          </div>
        ))}
        <div className="inline-actions">
          <AsyncButton
            variant="secondary"
            onAction={() =>
              run(() => addPracticeStarters(p.id), 'Starter routines added; existing edits kept')
            }
          >
            Add starter routines
          </AsyncButton>
          <Button
            variant="secondary"
            onClick={() => {
              setExpected(p.revision);
              setSettings(true);
            }}
          >
            Practice goals
          </Button>
          <Field label="Import practice library">
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  if (file.size > 5 * 1024 * 1024) throw Error('Choose a file under 5 MB.');
                  const parsed = parsePracticeLibrary(await file.text());
                  if (parsed.system !== p.id)
                    throw Error(
                      'Open the ' + practiceName(parsed.system) + ' library to import this file.',
                    );
                  setIncoming(parsed);
                  setError('');
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          </Field>
        </div>
        {error && <p role="alert">{error}</p>}
        <p className="small-text muted">
          Sharing includes the routine, drill instructions and setup. Check notes and links before
          sharing. Your results, history and weekly goals stay private.
        </p>
      </Card>
      <Card>
        <SectionTitle
          title="Drill library"
          action={
            <Button
              onClick={() => {
                setExpected(p.revision);
                setDrill(freshDrill());
              }}
            >
              New drill
            </Button>
          }
        />
        <div className="practice-filters">
          <Field label="Find a drill">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {[...new Set(p.drills.map((d) => d.category))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        {p.id === 'football' && (
          <div className="practice-filters">
            <Field label="Available space">
              <select value={space} onChange={(e) => setSpace(e.target.value)}>
                <option value="">Any space</option>
                <option value="small">Small space</option>
                <option value="pitch">Pitch / open space</option>
              </select>
            </Field>
            <label className="check-label">
              <input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} />
              Solo drills only
            </label>
            <p className="small-text muted">
              Search also matches equipment such as cones, wall or goal.
            </p>
          </div>
        )}
        {!p.drills.length && (
          <Empty compact title="Your drills live here">
            Create your own or add the starter warm-ups.
          </Empty>
        )}
        {p.drills
          .filter(
            (d) =>
              (!category || d.category === category) &&
              (!space || d.space === 'any' || d.space === space) &&
              (!solo || !d.partner) &&
              (d.name + ' ' + d.equipment).toLowerCase().includes(filter.toLowerCase()),
          )
          .map((d) => (
            <div className="practice-row" key={d.id}>
              <div>
                <h3>
                  {d.name}
                  {d.archived ? ' (archived)' : ''}
                </h3>
                <p>
                  {d.category} · {metrics[d.metric]}
                </p>
                <p className="muted">{d.cue}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setExpected(p.revision);
                  setDrill(structuredClone(d));
                }}
              >
                Edit {d.name}
              </Button>
            </div>
          ))}
      </Card>
      {drill && (
        <DrillEditor
          system={p.id}
          drill={drill}
          onClose={() => setDrill(undefined)}
          onSave={async (d) => {
            const result = await run(
              () => saveLibrary({ drills: [...p.drills.filter((x) => x.id !== d.id), d] }),
              'Drill saved',
            );
            if (result) setDrill(undefined);
          }}
        />
      )}
      {routine && (
        <RoutineEditor
          p={p}
          routine={routine}
          onClose={() => setRoutine(undefined)}
          onSave={async (r) => {
            if (
              await run(
                () => saveLibrary({ routines: [...p.routines.filter((x) => x.id !== r.id), r] }),
                'Routine saved',
              )
            )
              setRoutine(undefined);
          }}
          onDelete={async () => {
            if (!confirm('Delete this routine? Existing practice history stays saved.')) return;
            if (
              await run(
                () => saveLibrary({ routines: p.routines.filter((x) => x.id !== routine.id) }),
                'Routine deleted',
              )
            )
              setRoutine(undefined);
          }}
        />
      )}
      {settings && (
        <GoalEditor
          p={p}
          onClose={() => setSettings(false)}
          onSave={async (goal, focus) => {
            if (await run(() => saveLibrary({ goal, focus }), 'Practice goals saved'))
              setSettings(false);
          }}
        />
      )}
      {incoming && (
        <Modal title="Review practice library" onClose={() => setIncoming(undefined)}>
          <p>
            {incoming.routines.length} routines · {incoming.drills.length} drills
          </p>
          {incoming.routines.map((r) => (
            <p key={r.id}>
              <strong>{r.name}</strong> · {r.blocks.length} blocks
            </p>
          ))}
          <p>
            Imports add copies with no scheduled weekdays. Existing routines and results are
            retained. Importing this same file again adds no duplicates.
          </p>
          <AsyncButton
            onAction={async () => {
              if (
                await run(() => importPracticeLibrary(incoming, p.id), 'Practice library imported')
              )
                setIncoming(undefined);
            }}
          >
            Import library
          </AsyncButton>
        </Modal>
      )}
    </>
  );
}
function GoalEditor({
  p,
  onSave,
  onClose,
}: {
  p: PracticeData;
  onSave: (goal: number, focus: string) => Promise<void>;
  onClose: () => void;
}) {
  const [goal, setGoal] = useState(p.goal);
  const [focus, setFocus] = useState(p.focus);
  return (
    <Modal title="Practice goals" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(goal, focus);
        }}
      >
        <Field label="Sessions per week">
          <input
            type="number"
            min="1"
            max="14"
            required
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
          />
        </Field>
        <Field label="Current focus">
          <textarea maxLength={500} value={focus} onChange={(e) => setFocus(e.target.value)} />
        </Field>
        <Button type="submit">Save goals</Button>
      </form>
    </Modal>
  );
}
function DrillEditor({
  system,
  drill,
  onSave,
  onClose,
}: {
  system: PracticeSystem;
  drill: PracticeDrill;
  onSave: (d: PracticeDrill) => Promise<void>;
  onClose: () => void;
}) {
  const [d, setD] = useState(drill);
  const [error, setError] = useState('');
  const patch = (change: Partial<PracticeDrill>) => setD({ ...d, ...change });
  return (
    <Modal title="Edit drill" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const checked = DrillSchema.safeParse(d);
          if (!checked.success) {
            setError(checked.error.issues[0].message);
            return;
          }
          void onSave(checked.data);
        }}
      >
        <div className="practice-form-grid">
          <Field label="Drill name">
            <input
              required
              maxLength={150}
              value={d.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <input
              required
              maxLength={100}
              value={d.category}
              onChange={(e) => patch({ category: e.target.value })}
            />
          </Field>
          <Field label="Result to track">
            <select
              value={d.metric}
              onChange={(e) => patch({ metric: e.target.value as PracticeDrill['metric'] })}
            >
              {Object.entries(metrics).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Focus cue">
          <textarea value={d.cue} onChange={(e) => patch({ cue: e.target.value })} />
        </Field>
        <Field label="Setup / difficulty">
          <textarea
            maxLength={2000}
            value={d.setup}
            onChange={(e) => patch({ setup: e.target.value })}
          />
        </Field>
        <p className="small-text muted">
          Changing the setup keeps earlier results in their own comparison series.
        </p>
        {system === 'rocket-league' && (
          <>
            <Field label="Training pack code">
              <input
                maxLength={100}
                value={d.packCode}
                onChange={(e) => patch({ packCode: e.target.value })}
              />
            </Field>
            <Field label="Training pack or reference link">
              <input
                type="url"
                maxLength={1000}
                value={d.link}
                onChange={(e) => patch({ link: e.target.value })}
              />
            </Field>
          </>
        )}
        {system === 'football' && (
          <>
            <div className="practice-form-grid">
              <Field label="Foot">
                <select
                  value={d.foot}
                  onChange={(e) => patch({ foot: e.target.value as PracticeDrill['foot'] })}
                >
                  {['both', 'left', 'right', 'alternating'].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Field>
              <Field label="Equipment">
                <input
                  maxLength={300}
                  value={d.equipment}
                  onChange={(e) => patch({ equipment: e.target.value })}
                />
              </Field>
              <Field label="Space needed">
                <select
                  value={d.space}
                  onChange={(e) => patch({ space: e.target.value as PracticeDrill['space'] })}
                >
                  <option value="any">Any</option>
                  <option value="small">Small space</option>
                  <option value="pitch">Pitch / open space</option>
                </select>
              </Field>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={d.partner}
                onChange={(e) => patch({ partner: e.target.checked })}
              />
              Needs a partner
            </label>
            <CourseEditor drill={d} onChange={(cones) => patch({ cones })} />
          </>
        )}
        <label className="check-label">
          <input
            type="checkbox"
            checked={d.archived}
            onChange={(e) => patch({ archived: e.target.checked })}
          />
          Archive drill (existing routines and history are retained)
        </label>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">Save drill</Button>
      </form>
    </Modal>
  );
}
function RoutineEditor({
  p,
  routine,
  onSave,
  onClose,
  onDelete,
}: {
  p: PracticeData;
  routine: PracticeRoutine;
  onSave: (r: PracticeRoutine) => Promise<void>;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [r, setR] = useState(routine);
  const [error, setError] = useState('');
  const updateBlock = (i: number, patch: Partial<PracticeRoutine['blocks'][number]>) =>
    setR({ ...r, blocks: r.blocks.map((b, n) => (i === n ? { ...b, ...patch } : b)) });
  return (
    <Modal title="Edit routine" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const checked = PracticeRoutineSchema.safeParse(r);
          if (!checked.success) {
            setError(checked.error.issues[0].message);
            return;
          }
          void onSave(checked.data);
        }}
      >
        <Field label="Routine name">
          <input
            required
            maxLength={150}
            value={r.name}
            onChange={(e) => setR({ ...r, name: e.target.value })}
          />
        </Field>
        <Field label="Routine notes">
          <textarea value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} />
        </Field>
        <fieldset>
          <legend>Weekly plan (optional)</legend>
          <div className="inline-actions">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, n) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={r.weekdays.includes(n)}
                  onChange={(e) =>
                    setR({
                      ...r,
                      weekdays: e.target.checked
                        ? [...r.weekdays, n]
                        : r.weekdays.filter((d) => d !== n),
                    })
                  }
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
        {r.blocks.map((b, i) => (
          <fieldset className="practice-block" key={b.id}>
            <legend>Block {i + 1}</legend>
            <Field label={'Drill for block ' + (i + 1)}>
              <select
                value={b.drillId}
                onChange={(e) => updateBlock(i, { drillId: e.target.value })}
              >
                {p.drills
                  .filter((d) => !d.archived || d.id === b.drillId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="practice-form-grid">
              {(['sets', 'seconds', 'target', 'restSeconds'] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      sets: 'Sets',
                      seconds: 'Work timer (seconds; 0 = open)',
                      target: 'Attempts / streak target (0 = none)',
                      restSeconds: 'Rest (seconds)',
                    }[key]
                  }
                >
                  <input
                    type="number"
                    min={key === 'sets' ? 1 : 0}
                    max={
                      key === 'sets'
                        ? 20
                        : key === 'seconds'
                          ? 86400
                          : key === 'target'
                            ? 100000
                            : 3600
                    }
                    value={b[key]}
                    onChange={(e) => updateBlock(i, { [key]: Number(e.target.value) })}
                    required
                  />
                </Field>
              ))}
            </div>
            <Field label="Block focus / playlist">
              <input
                maxLength={10000}
                value={b.cue}
                onChange={(e) => updateBlock(i, { cue: e.target.value })}
              />
            </Field>
            <div className="inline-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={i === 0}
                onClick={() => {
                  const blocks = [...r.blocks];
                  [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
                  setR({ ...r, blocks });
                }}
              >
                Move up
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={i === r.blocks.length - 1}
                onClick={() => {
                  const blocks = [...r.blocks];
                  [blocks[i], blocks[i + 1]] = [blocks[i + 1], blocks[i]];
                  setR({ ...r, blocks });
                }}
              >
                Move down
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={r.blocks.length === 1}
                onClick={() => setR({ ...r, blocks: r.blocks.filter((x) => x.id !== b.id) })}
              >
                Remove block
              </Button>
            </div>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={r.blocks.length >= 50}
          onClick={() =>
            setR({
              ...r,
              blocks: [
                ...r.blocks,
                {
                  id: uid(),
                  drillId: (p.drills.find((d) => !d.archived) ?? p.drills[0]).id,
                  sets: 1,
                  seconds: 180,
                  target: 0,
                  restSeconds: 0,
                  cue: '',
                },
              ],
            })
          }
        >
          Add block
        </Button>
        {error && <p role="alert">{error}</p>}
        <div className="inline-actions">
          <Button type="submit">Save routine</Button>
          {p.routines.some((x) => x.id === r.id) && (
            <Button type="button" variant="danger" onClick={() => void onDelete()}>
              Delete routine
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
function SessionView({ p }: { p: PracticeData }) {
  const s = p.sessions.find((s) => s.status === 'active');
  return s ? (
    <Runner key={s.id} system={p.id} session={s} />
  ) : (
    <Card>
      <SectionTitle title="Choose your practice" />
      <PracticeStart p={p} />
    </Card>
  );
}
function Runner({ system, session: s }: { system: PracticeSystem; session: PracticeSession }) {
  const { run, toast } = useApp();
  const [at, setAt] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setAt(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const entry = s.entries[s.cursor];
  const elapsed = timerSeconds(s, at);
  const remaining = Math.max(0, s.timer.targetSeconds - elapsed);
  const rest = s.timer.phase === 'rest';
  const command = (action: PracticeCommand, result?: PracticeResult) =>
    run(() => practiceCommand(system, s.id, entry.id, action, result));
  return (
    <>
      <Card>
        <p className="eyebrow">
          {s.name} · {s.cursor + 1} / {s.entries.length} · set {entry.set}
        </p>
        <h2>
          {rest ? 'Rest · ' : ''}
          {entry.drill.name}
        </h2>
        <p className="practice-cue">{entry.block.cue || entry.drill.cue}</p>
        {entry.drill.setup && <p className="muted">{entry.drill.setup}</p>}
        {entry.drill.packCode && (
          <p>
            Training pack: <code>{entry.drill.packCode}</code>
          </p>
        )}
        {entry.drill.link && (
          <a href={entry.drill.link} target="_blank" rel="noreferrer">
            Open drill reference
          </a>
        )}
        {entry.block.target > 0 && (
          <p>
            Target: {entry.block.target}{' '}
            {entry.drill.metric === 'streak' ? 'consecutive' : 'attempts'}. Stop earlier whenever
            you choose.
          </p>
        )}
        {system === 'football' && (
          <>
            <p>Foot: {entry.drill.foot}</p>
            {entry.drill.cones.length > 0 && <CourseDiagram drill={entry.drill} />}
          </>
        )}
        <div className="practice-clock" aria-label={rest ? 'Rest timer' : 'Practice timer'}>
          {clockText(s.timer.targetSeconds ? remaining : elapsed)}
        </div>
        {s.timer.targetSeconds > 0 && remaining === 0 && (
          <p role="status">
            {rest
              ? 'Rest complete. Continue when ready.'
              : 'Timer complete. Record this set when ready.'}
          </p>
        )}
        <AsyncButton
          variant="secondary"
          onAction={() => command(s.timer.runningSince === undefined ? 'resume' : 'pause')}
        >
          {s.timer.runningSince === undefined ? 'Resume timer' : 'Pause timer'}
        </AsyncButton>
        {!rest ? (
          <ResultForm
            key={entry.id}
            system={system}
            entry={entry}
            onSave={async (result) => {
              await command('complete', result);
            }}
            onQuick={async () => {
              await command('complete');
            }}
            onSkip={async () => {
              await command('skip');
            }}
          />
        ) : (
          <div className="inline-actions">
            {s.cursor + 1 < s.entries.length && (
              <AsyncButton onAction={() => command('next')}>Next set</AsyncButton>
            )}
            <AsyncButton variant="secondary" onAction={() => command('repeat')}>
              Repeat set
            </AsyncButton>
            <AsyncButton
              onAction={async () => {
                if (
                  s.entries.some((e) => e.status === 'pending') &&
                  !confirm('Finish now? Unfinished blocks will be marked skipped.')
                )
                  return;
                if (await command('finish')) {
                  toast('Practice saved');
                  go(system + '-history');
                }
              }}
            >
              Finish session
            </AsyncButton>
          </div>
        )}
        <p className="small-text muted">
          Saved on this device. The timer continues while away unless paused. Results are recorded
          manually.
        </p>
      </Card>
      <details className="card">
        <summary>Session blocks</summary>
        {s.entries.map((e, i) => (
          <p key={e.id}>
            {i + 1}. {e.drill.name} · set {e.set} · {e.status}
          </p>
        ))}
      </details>
      <AsyncButton
        variant="danger"
        onAction={async () => {
          if (!confirm('Discard this practice session?')) return;
          const undo = await run(() => deletePracticeSession(system, s.id));
          if (undo) toast('Practice discarded', undo);
        }}
      >
        Discard session
      </AsyncButton>
    </>
  );
}
function ResultForm({
  system,
  entry,
  onSave,
  onQuick,
  onSkip,
}: {
  system: PracticeSystem;
  entry: PracticeEntry;
  onSave: (r: PracticeResult) => Promise<void>;
  onQuick?: () => Promise<void>;
  onSkip?: () => Promise<void>;
}) {
  const [shots, setShots] = useState(entry.result?.shots ?? []);
  const [zone, setZone] = useState(0);
  const [useMap, setUseMap] = useState(Boolean(entry.result?.shots.length));
  const [tries, setTries] = useState(entry.result?.tries?.join(', ') ?? '');
  const [attempts, setAttempts] = useState(entry.result?.attempts?.toString() ?? '');
  const [hits, setHits] = useState(entry.result?.hits?.toString() ?? '');
  const [best, setBest] = useState(entry.result?.best?.toString() ?? '');
  const [course, setCourse] = useState(entry.result?.courseSeconds?.toString() ?? '');
  const [notes, setNotes] = useState(entry.result?.notes ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          attempts: useMap ? shots.length : attempts === '' ? undefined : Number(attempts),
          hits: useMap ? shots.filter((s) => s.hit).length : hits === '' ? undefined : Number(hits),
          best: tries.trim()
            ? Math.max(...tries.split(',').map((s) => Number(s.trim())))
            : best === ''
              ? undefined
              : Number(best),
          tries: tries.trim() ? tries.split(',').map((s) => Number(s.trim())) : [],
          courseSeconds: course === '' ? undefined : Number(course),
          notes,
          shots: useMap ? shots : [],
        });
      }}
    >
      {system === 'football' && entry.drill.metric === 'accuracy' && (
        <>
          <label className="check-label">
            <input type="checkbox" checked={useMap} onChange={(e) => setUseMap(e.target.checked)} />
            Record each attempt on the target map
          </label>
          {useMap && (
            <ShotRecorder shots={shots} zone={zone} setZone={setZone} onChange={setShots} />
          )}
        </>
      )}
      <div className="practice-form-grid">
        {entry.drill.metric === 'accuracy' && !useMap && (
          <>
            <Field label="Attempts">
              <input
                type="number"
                min="0"
                max="100000"
                step="1"
                value={attempts}
                onChange={(e) => setAttempts(e.target.value)}
              />
            </Field>
            <Field label="Hits">
              <input
                type="number"
                min="0"
                max={attempts || 100000}
                step="1"
                value={hits}
                onChange={(e) => setHits(e.target.value)}
              />
            </Field>
          </>
        )}
        {entry.drill.metric === 'streak' && (
          <Field label="Attempt streaks (comma separated, optional)">
            <input
              value={tries}
              pattern={String.raw`[0-9]+(\s*,\s*[0-9]+)*`}
              onChange={(e) => setTries(e.target.value)}
              placeholder="8, 12, 7, 15"
            />
          </Field>
        )}
        {entry.drill.metric === 'streak' && !tries.trim() && (
          <Field label="Best consecutive streak">
            <input
              type="number"
              min="0"
              max="100000"
              value={best}
              onChange={(e) => setBest(e.target.value)}
            />
          </Field>
        )}
        {entry.drill.metric === 'course' && (
          <Field label="Course time (seconds)">
            <input
              type="number"
              min="0.01"
              max="86400"
              step="0.01"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            />
          </Field>
        )}
      </div>
      <Field label="Set notes">
        <textarea value={notes} maxLength={10000} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="inline-actions">
        <Button type="submit">{onQuick ? 'Record & rest' : 'Save result'}</Button>
        {onQuick && (
          <AsyncButton variant="secondary" onAction={onQuick}>
            Complete without results
          </AsyncButton>
        )}
        {onSkip && (
          <AsyncButton variant="ghost" onAction={onSkip}>
            Skip set
          </AsyncButton>
        )}
      </div>
    </form>
  );
}
function PracticeHistory({ p }: { p: PracticeData }) {
  const { run, toast } = useApp();
  const [selected, setSelected] = useState<PracticeSession>();
  const [expected, setExpected] = useState(0);
  const sessions = p.sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  return (
    <>
      <Card>
        <SectionTitle title="This week" />
        <PracticeWeek p={p} />
        <p>Current focus: {p.focus || 'Choose a focus in Practice goals.'}</p>
        <a href={'#/' + p.id + '-library'}>Edit practice goals</a>
      </Card>
      <div className="grid-2">
        <Card>
          <SectionTitle title="Drill progress & personal bests" />
          <PracticeProgress p={p} />
        </Card>
        <Card>
          <SectionTitle title="Practice balance" />
          <PracticeBalance p={p} />
        </Card>
      </div>
      <Card>
        <SectionTitle title="Saved sessions" />
        {!sessions.length && (
          <Empty compact title="No practice recorded yet">
            Finish a session and your results will appear here.
          </Empty>
        )}
        {sessions.map((s) => (
          <div className="practice-row" key={s.id}>
            <div>
              <h3>{s.name}</h3>
              <p>
                {new Date(s.startAt).toLocaleDateString()} ·{' '}
                {s.entries.filter((e) => e.status === 'completed').length} completed sets
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setExpected(p.revision);
                setSelected(structuredClone(s));
              }}
            >
              View {s.name}
            </Button>
          </div>
        ))}
      </Card>
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(undefined)} wide>
          <p>{new Date(selected.startAt).toLocaleString()}</p>
          {selected.entries.map((e) => (
            <details key={e.id} className="practice-block">
              <summary>
                {e.drill.name} · set {e.set} · {e.status}
              </summary>
              <p>{e.drill.setup}</p>
              {e.status === 'completed' && (
                <>
                  <p>Practice time: {clockText(e.elapsedSeconds)}</p>
                  <ResultForm
                    system={p.id}
                    entry={e}
                    onSave={async (result) => {
                      const saved = await run(
                        () =>
                          changePractice(
                            p.id,
                            (current) => {
                              const s = current.sessions.find((s) => s.id === selected.id);
                              if (!s) throw Error('Session no longer exists.');
                              s.entries.find((x) => x.id === e.id)!.result = result;
                            },
                            undefined,
                            expected,
                          ),
                        'Result corrected',
                      );
                      if (saved) {
                        setExpected(saved.revision);
                        setSelected(
                          structuredClone(saved.sessions.find((s) => s.id === selected.id)!),
                        );
                      }
                    }}
                  />
                </>
              )}
            </details>
          ))}
          <AsyncButton
            variant="danger"
            onAction={async () => {
              if (!confirm('Delete this practice session?')) return;
              const undo = await run(() => deletePracticeSession(p.id, selected.id));
              if (undo) {
                setSelected(undefined);
                toast('Practice session deleted', undo);
              }
            }}
          >
            Delete session
          </AsyncButton>
        </Modal>
      )}
    </>
  );
}

export function CourseDiagram({ drill }: { drill: PracticeDrill }) {
  return (
    <svg
      className="practice-diagram"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${drill.name}: ${drill.cones.length} numbered cones, connected in order. ${drill.setup}`}
    >
      <rect x="3" y="3" width="94" height="94" fill="none" stroke="#d3e6d9" strokeWidth="0.5" />
      <path d="M3 50H97" fill="none" stroke="#d3e6d9" strokeWidth="0.3" />
      <polyline
        points={drill.cones.map((p) => `${p.x},${p.y}`).join(' ')}
        stroke="#fff"
        strokeWidth=".8"
        fill="none"
        strokeDasharray="2 2"
      />
      {drill.cones.map((p, i) => (
        <g key={i}>
          <path
            d={`M${p.x},${p.y - 3}l-2.5,5h5z`}
            fill="#ffba68"
            stroke="#163727"
            strokeWidth=".5"
          />
          <text x={p.x + 4} y={p.y + 1} fill="white" fontSize="4">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
function CourseEditor({
  drill,
  onChange,
}: {
  drill: PracticeDrill;
  onChange: (cones: PracticeDrill['cones']) => void;
}) {
  const [open, setOpen] = useState(drill.cones.length > 0);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="practice-block">
      <summary>Cone course diagram (optional)</summary>
      <p>
        Tap to add cones in route order, or use Add cone and edit the positions below. Enter real
        distances in Setup; this diagram is a sketch.
      </p>
      <button
        type="button"
        className="practice-course-button"
        disabled={drill.cones.length >= 30}
        aria-label="Add cone at a point on the course"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.detail
            ? Math.min(98, Math.max(2, Math.round(((e.clientX - rect.left) / rect.width) * 100)))
            : 50;
          const y = e.detail
            ? Math.min(98, Math.max(2, Math.round(((e.clientY - rect.top) / rect.height) * 100)))
            : 50;
          onChange([...drill.cones, { x, y }]);
        }}
      >
        <CourseDiagram drill={drill} />
      </button>
      <div className="inline-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={drill.cones.length >= 30}
          onClick={() => onChange([...drill.cones, { x: 50, y: 50 }])}
        >
          Add cone
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!drill.cones.length}
          onClick={() => onChange(drill.cones.slice(0, -1))}
        >
          Remove last cone
        </Button>
      </div>
      {drill.cones.map((p, i) => (
        <div className="practice-form-grid" key={i}>
          {(['x', 'y'] as const).map((axis) => (
            <Field key={axis} label={`Cone ${i + 1} ${axis}`}>
              <input
                type="number"
                min="2"
                max="98"
                value={p[axis]}
                onChange={(e) =>
                  onChange(
                    drill.cones.map((p, n) =>
                      n === i ? { ...p, [axis]: Number(e.target.value) } : p,
                    ),
                  )
                }
                required
              />
            </Field>
          ))}
        </div>
      ))}
    </details>
  );
}
const zoneNames = [
  'Top left',
  'Top centre',
  'Top right',
  'Bottom left',
  'Bottom centre',
  'Bottom right',
];
function ShotRecorder({
  shots,
  zone,
  setZone,
  onChange,
}: {
  shots: PracticeResult['shots'];
  zone: number;
  setZone: (zone: number) => void;
  onChange: (shots: PracticeResult['shots']) => void;
}) {
  return (
    <fieldset className="practice-block">
      <legend>Shot target map</legend>
      <p>
        Choose your intended target, then record whether you hit it. These are target zones, rather
        than measured landing positions.
      </p>
      <div className="practice-targets">
        {zoneNames.map((label, i) => {
          const rows = shots.filter((s) => s.zone === i);
          return (
            <button type="button" key={label} aria-pressed={zone === i} onClick={() => setZone(i)}>
              {label}
              <br />
              {rows.filter((s) => s.hit).length} / {rows.length}
            </button>
          );
        })}
      </div>
      <div className="inline-actions">
        <Button
          type="button"
          disabled={shots.length >= 1000}
          onClick={() => onChange([...shots, { zone, hit: true }])}
        >
          Hit target
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={shots.length >= 1000}
          onClick={() => onChange([...shots, { zone, hit: false }])}
        >
          Missed target
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!shots.length}
          onClick={() => onChange(shots.slice(0, -1))}
        >
          Undo last attempt
        </Button>
      </div>
      <p aria-live="polite">
        {shots.filter((s) => s.hit).length} hits / {shots.length} attempts
      </p>
    </fieldset>
  );
}
