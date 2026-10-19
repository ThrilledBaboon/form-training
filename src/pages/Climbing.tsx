import { useState } from 'react';
import { useApp } from '../lib/context';
import { now, uid } from '../lib/model';
import { foodDay } from '../lib/food-calc';
import { imageFile } from '../lib/food-actions';
import {
  climbTypes,
  climbTypeName,
  climbSnapshot,
  emptyClimbing,
  type Climb,
  type ClimbingSession,
  type ClimbingEntry,
} from '../lib/climbing-model';
import { newClimb, saveClimbingRecord, deleteClimbingSession } from '../lib/climbing-actions';
import { Button, AsyncButton, Card, Empty, Field, Modal, PageTitle } from '../components/ui';

export function ClimbingNav() {
  return (
    <nav className="food-actions" aria-label="Climbing tools">
      <a className="button secondary" href="#/climbing-home">
        Climbing overview
      </a>
      <a className="button secondary" href="#/climbing-log">
        Sessions
      </a>
      <a className="button secondary" href="#/climbing-library">
        Climb library
      </a>
      <a className="button secondary" href="#/climbing-projects">
        Projects
      </a>
    </nav>
  );
}
function ClimbEditor({ initial, onClose }: { initial?: Climb; onClose: () => void }) {
  const { run } = useApp();
  const [v, set] = useState(initial ?? newClimb());
  const [dirty, setDirty] = useState(false);
  const patch = (p: Partial<Climb>) => {
    set({ ...v, ...p });
    setDirty(true);
  };
  const close = () => {
    if (!dirty || confirm('Discard unsaved climb changes?')) onClose();
  };
  return (
    <Modal title={initial ? 'Edit climb' : 'Add a climb'} onClose={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await saveClimbingRecord('climbs', v, initial?.updatedAt);
            onClose();
          }, 'Climb saved');
        }}
      >
        <Field label="Climb name">
          <input
            required
            maxLength={200}
            value={v.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="Climbing type">
          <select value={v.type} onChange={(e) => patch({ type: e.target.value as Climb['type'] })}>
            {climbTypes.map((t) => (
              <option key={t} value={t}>
                {climbTypeName[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Environment">
          <select
            value={v.environment}
            onChange={(e) => patch({ environment: e.target.value as Climb['environment'] })}
          >
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </Field>
        <Field label="Gym, crag or area">
          <input
            maxLength={200}
            value={v.venue}
            onChange={(e) => patch({ venue: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="Grade (optional)">
            <input
              maxLength={80}
              placeholder="e.g. V3, 6b, purple"
              value={v.grade}
              onChange={(e) => patch({ grade: e.target.value })}
            />
          </Field>
          <Field
            label="Grade scale (optional)"
            hint="Use the gym’s colour scale or the recorded grading system. Grades are never converted."
          >
            <input
              maxLength={80}
              placeholder="e.g. V scale, Font, French, gym colours"
              value={v.gradeScale}
              onChange={(e) => patch({ gradeScale: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Project status">
          <select
            value={v.project}
            onChange={(e) => patch({ project: e.target.value as Climb['project'] })}
          >
            <option value="none">Not a project</option>
            <option value="active">Working on it</option>
            <option value="completed">Completed project</option>
          </select>
        </Field>
        <Field label="Beta & notes">
          <textarea
            maxLength={10000}
            value={v.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </Field>
        <Field label="Next try">
          <textarea
            maxLength={10000}
            placeholder="What would you like to try next time?"
            value={v.nextTry}
            onChange={(e) => patch({ nextTry: e.target.value })}
          />
        </Field>
        {v.photo && (
          <div>
            <img className="climb-photo" src={v.photo.data} alt={v.name || 'Climb reference'} />
            <Button type="button" variant="ghost" onClick={() => patch({ photo: undefined })}>
              Remove photo
            </Button>
          </div>
        )}
        <Field
          label={v.photo ? 'Replace climb photo' : 'Climb photo (optional)'}
          hint="PNG, JPEG or WebP, up to 5 MB. Stored only on this device and in your backups."
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () => {
                  patch({ photo: await imageFile(file) });
                });
              e.target.value = '';
            }}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={v.archived}
            onChange={(e) => patch({ archived: e.target.checked })}
          />{' '}
          Archived / reset from wall
        </label>
        <p className="small-text muted">
          Archiving hides this climb from new sessions. Past sessions keep their original name,
          grade and venue. Mark project completion here when you are ready.
        </p>
        <Button type="submit">Save climb</Button>
      </form>
    </Modal>
  );
}
function SessionEditor({ initial, onClose }: { initial?: ClimbingSession; onClose: () => void }) {
  const { data, run } = useApp();
  const library = (data.climbing ?? emptyClimbing).climbs.filter((c) => !c.archived);
  const planId = new URLSearchParams(location.hash.split('?')[1]).get('plan');
  const plan = (data.climbing ?? emptyClimbing).plans.find((p) => p.id === planId);
  const [v, set] = useState<ClimbingSession>(
    initial ?? {
      id: uid(),
      name: plan?.name ?? 'Climbing session',
      date: plan?.date ?? foodDay(),
      notes: plan?.notes ?? '',
      planId: plan?.id,
      status: 'draft',
      entries: [],
      updatedAt: now(),
    },
  );
  const [selected, select] = useState('');
  const [dirty, setDirty] = useState(false);
  const patch = (p: Partial<ClimbingSession>) => {
    set({ ...v, ...p });
    setDirty(true);
  };
  const entry = (id: string, p: Partial<ClimbingEntry>) =>
    patch({ entries: v.entries.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const close = () => {
    if (!dirty || confirm('Discard unsaved session changes? Use Save draft to keep them.'))
      onClose();
  };
  const save = (status: ClimbingSession['status']) =>
    run(
      async () => {
        if (status === 'completed' && v.date > foodDay())
          throw Error(
            'Use the week planner for future sessions. Completed sessions cannot be in the future.',
          );
        await saveClimbingRecord('sessions', { ...v, status }, initial?.updatedAt);
        onClose();
      },
      status === 'draft' ? 'Climbing draft saved' : 'Climbing session saved',
    );
  return (
    <Modal title={initial ? 'Edit climbing session' : 'Log climbing session'} onClose={close} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save('completed');
        }}
      >
        <div className="form-grid">
          <Field label="Session name">
            <input
              required
              maxLength={200}
              value={v.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="Session date">
            <input
              required
              type="date"
              max={foodDay()}
              value={v.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </Field>
          <Field
            label="Duration in minutes (optional)"
            hint="Leave blank if unknown; no duration is invented."
          >
            <input
              type="number"
              min={1}
              max={1440}
              value={v.durationMinutes ?? ''}
              onChange={(e) =>
                patch({ durationMinutes: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>
        </div>
        <Field label="Add library climb">
          <select value={selected} onChange={(e) => select(e.target.value)}>
            <option value="">Choose a climb</option>
            {library.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.grade || 'ungraded'} · {c.venue || climbTypeName[c.type]}
              </option>
            ))}
          </select>
        </Field>
        <Button
          type="button"
          variant="secondary"
          disabled={!selected || v.entries.length >= 500}
          onClick={() => {
            const c = library.find((c) => c.id === selected);
            if (c)
              patch({
                entries: [
                  ...v.entries,
                  {
                    id: uid(),
                    climbId: c.id,
                    snapshot: climbSnapshot(c),
                    attempts: 1,
                    result: 'attempt',
                    notes: '',
                  },
                ],
              });
            select('');
          }}
        >
          Add to session
        </Button>
        {!library.length && (
          <p>
            Add climbs in the <a href="#/climbing-library">climb library</a> first. Save a draft
            before leaving this session.
          </p>
        )}
        {v.entries.map((e, index) => (
          <fieldset className="climbing-entry" key={e.id}>
            <legend>
              {index + 1}. {e.snapshot.name} · {e.snapshot.grade || 'Ungraded'}
            </legend>
            <p className="small-text muted">
              {climbTypeName[e.snapshot.type]} · {e.snapshot.environment} ·{' '}
              {e.snapshot.venue || 'Venue unspecified'} ·{' '}
              {e.snapshot.gradeScale || 'Scale unspecified'}
            </p>
            <div className="form-grid">
              <Field label={`Attempts for ${e.snapshot.name}`}>
                <input
                  required
                  type="number"
                  min={1}
                  max={10000}
                  value={e.attempts}
                  onChange={(ev) => entry(e.id, { attempts: Number(ev.target.value) })}
                />
              </Field>
              <Field label={`Result for ${e.snapshot.name}`}>
                <select
                  value={e.result}
                  onChange={(ev) =>
                    entry(e.id, { result: ev.target.value as ClimbingEntry['result'] })
                  }
                >
                  <option value="attempt">Attempts only</option>
                  <option value="completed">Completed cleanly</option>
                  <option value="with_rests">Reached top with rests</option>
                  <option value="flash">Flash / first go clean</option>
                </select>
              </Field>
            </div>
            <Field label={`Notes for ${e.snapshot.name}`}>
              <textarea
                value={e.notes}
                maxLength={10000}
                onChange={(ev) => entry(e.id, { notes: ev.target.value })}
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              onClick={() => patch({ entries: v.entries.filter((x) => x.id !== e.id) })}
            >
              Remove {e.snapshot.name} from session
            </Button>
          </fieldset>
        ))}
        <Field label="Session notes">
          <textarea
            maxLength={10000}
            value={v.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </Field>
        <div className="inline-actions">
          {initial?.status !== 'completed' && (
            <AsyncButton type="button" variant="secondary" onAction={() => save('draft')}>
              Save draft
            </AsyncButton>
          )}
          <Button type="submit" disabled={!v.entries.length}>
            {initial?.status === 'completed' ? 'Save changes' : 'Finish session'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Climbing({ view }: { view: 'library' | 'projects' | 'log' }) {
  const { data, run, toast } = useApp();
  const climbing = data.climbing ?? emptyClimbing;
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const [climb, editClimb] = useState<Climb | null>();
  const [session, editSession] = useState<ClimbingSession | null | undefined>(() =>
    params.has('new') ? null : undefined,
  );
  const [showArchived, archived] = useState(false);
  const [search, setSearch] = useState('');
  const climbs = climbing.climbs.filter(
    (c) =>
      (showArchived || !c.archived) &&
      (view !== 'projects' || c.project !== 'none') &&
      [c.name, c.venue, c.grade, c.gradeScale]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR CLIMBING"
        title={
          view === 'log'
            ? 'Climbing sessions'
            : view === 'projects'
              ? 'Your projects'
              : 'Climb library'
        }
        description="Bouldering, top rope, auto belay and lead — indoors and outdoors."
        action={
          <Button onClick={() => (view === 'log' ? editSession(null) : editClimb(null))}>
            {view === 'log' ? 'Log session' : 'Add climb'}
          </Button>
        }
      />
      <ClimbingNav />
      {view !== 'log' ? (
        <>
          <div className="food-actions">
            <Field label="Find a climb">
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => archived(e.target.checked)}
              />{' '}
              Include archived climbs
            </label>
          </div>
          {!climbs.length && (
            <Empty
              title={
                view === 'projects' ? 'Make room for your next project' : 'Start your climb library'
              }
            >
              Add a climb with its venue and grade, then log attempts in a session. Set its project
              status to “Working on it” to keep it here.
            </Empty>
          )}
          <div className="climbing-grid">
            {climbs.map((c) => (
              <Card key={c.id}>
                {c.photo && <img className="climb-photo" alt={c.name} src={c.photo.data} />}
                <h2>{c.name}</h2>
                <p>
                  {climbTypeName[c.type]} · {c.environment} · {c.venue || 'Venue unspecified'}
                </p>
                <p>
                  <strong>{c.grade || 'Ungraded'}</strong>
                  {c.gradeScale && ' · ' + c.gradeScale}
                  {c.archived && ' · Archived'}
                </p>
                {c.project !== 'none' && (
                  <p>{c.project === 'active' ? 'Working on it' : 'Completed project'}</p>
                )}
                {c.notes && <p className="preserve-lines">{c.notes}</p>}
                {c.nextTry && (
                  <p className="preserve-lines">
                    <strong>Next try: </strong>
                    {c.nextTry}
                  </p>
                )}
                <Button variant="secondary" onClick={() => editClimb(c)}>
                  Edit {c.name}
                </Button>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          {!climbing.sessions.length && (
            <Empty title="Your first climbing session">
              Create climbs in your library, then log a session. You can add previous days and save
              drafts to finish later.
            </Empty>
          )}
          <div className="climbing-grid">
            {[...climbing.sessions]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((s) => (
                <Card key={s.id}>
                  <h2>{s.name}</h2>
                  <p>
                    {s.date} · {s.status === 'draft' ? 'Draft' : 'Completed'} · {s.entries.length}{' '}
                    climbs
                    {s.durationMinutes
                      ? ' · ' + s.durationMinutes + ' min'
                      : ' · Duration unrecorded'}
                  </p>
                  {s.notes && <p className="preserve-lines">{s.notes}</p>}
                  <details>
                    <summary>Climbs & notes</summary>
                    {s.entries.map((e) => (
                      <div className="climbing-entry" key={e.id}>
                        <strong>
                          {e.snapshot.name} · {e.snapshot.grade || 'Ungraded'}
                        </strong>
                        <p>
                          {climbTypeName[e.snapshot.type]} ·{' '}
                          {e.snapshot.venue || 'Venue unspecified'} ·{' '}
                          {e.snapshot.gradeScale || 'Scale unspecified'}
                          <br />
                          {e.attempts} attempts · {e.result.replaceAll('_', ' ')}
                        </p>
                        {e.notes && <p className="preserve-lines">{e.notes}</p>}
                      </div>
                    ))}
                  </details>
                  <div className="inline-actions">
                    <Button variant="secondary" onClick={() => editSession(s)}>
                      {s.status === 'draft' ? 'Resume' : 'Edit'} {s.name}
                    </Button>
                    <AsyncButton
                      variant="ghost"
                      onAction={() =>
                        run(async () => {
                          if (!confirm(`Delete ${s.name}? You can undo this deletion.`)) return;
                          const undo = await deleteClimbingSession(s.id, s.updatedAt);
                          toast('Climbing session deleted', undo);
                        })
                      }
                    >
                      Delete {s.name}
                    </AsyncButton>
                  </div>
                </Card>
              ))}
          </div>
        </>
      )}
      {climb !== undefined && (
        <ClimbEditor initial={climb ?? undefined} onClose={() => editClimb(undefined)} />
      )}
      {session !== undefined && (
        <SessionEditor initial={session ?? undefined} onClose={() => editSession(undefined)} />
      )}
    </>
  );
}
