import { ImportPrompt } from './ImportPrompt';
import { useRef, useState } from 'react';
import { Download, Share2, Upload } from 'lucide-react';
import { useApp } from '../lib/context';
import { download } from '../lib/backup';
import { fromKg, fmt } from '../lib/calc';
import { muscleName } from '../lib/model';
import {
  createLibrary,
  parseLibrary,
  previewLibrary,
  importLibrary,
  LIBRARY_LIMIT,
  type LibraryFile,
  type LibrarySelection,
} from '../lib/library';
import { AsyncButton, Badge, Button, Field, Modal } from './ui';

function LibraryContents({ file }: { file: LibraryFile }) {
  const { data } = useApp();
  return (
    <div className="library-contents">
      <p className="small-text">
        {file.data.exercises.length} exercises · {file.data.routines.length} routines ·{' '}
        {file.data.programmes.length} programmes
      </p>
      {file.data.programmes.map((p) => (
        <div className="library-programme" key={p.id}>
          <strong>{p.name}</strong>
          <p className="small-text">
            {file.data.routines.filter((r) => r.programmeId === p.id).length} routines
          </p>
          {p.notes && <p className="library-notes">{p.notes}</p>}
        </div>
      ))}
      {file.data.routines.map((r) => (
        <details className="library-detail" key={r.id}>
          <summary>
            {r.name}
            <span>
              {r.items.length} exercises · {r.items.reduce((n, i) => n + i.sets.length, 0)} sets
            </span>
          </summary>
          {r.description && <p className="library-notes">{r.description}</p>}
          {r.weekdays.length > 0 && (
            <p className="small-text">
              Shared schedule:{' '}
              {r.weekdays
                .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                .join(', ')}
            </p>
          )}
          {r.groups.map((g) => (
            <p key={g.id} className="small-text">
              {g.name} · {g.type} · {g.restSeconds}s round rest
              {g.betweenSeconds !== undefined ? ` · ${g.betweenSeconds}s between exercises` : ''}
              {g.notes ? ` · ${g.notes}` : ''}
            </p>
          ))}
          {r.items.map((i) => (
            <div className="library-targets" key={i.id}>
              <strong>{i.name}</strong>
              <p className="small-text">
                {i.repMin}–{i.repMax} rep target · {i.restSeconds}s rest
                {i.groupId ? ` · ${r.groups.find((g) => g.id === i.groupId)?.name}` : ''}
              </p>
              <ol>
                {i.sets.map((s, index) => (
                  <li key={index}>
                    {[
                      s.label === 'custom' ? s.customLabel || 'Custom' : s.label,
                      s.loadKg !== undefined
                        ? `${fmt(fromKg(s.loadKg, data.settings.unit))} ${data.settings.unit}`
                        : undefined,
                      s.reps !== undefined ? `${s.reps} reps` : undefined,
                      s.durationSeconds !== undefined ? `${s.durationSeconds}s` : undefined,
                      s.distanceM !== undefined ? `${s.distanceM}m` : undefined,
                      s.restSeconds !== undefined ? `${s.restSeconds}s rest` : undefined,
                      s.groupId ? r.groups.find((g) => g.id === s.groupId)?.name : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </li>
                ))}
              </ol>
              {i.notes && <p className="library-notes">{i.notes}</p>}
            </div>
          ))}
        </details>
      ))}
      <details className="library-detail" open={!file.data.routines.length}>
        <summary>
          Included exercises<span>{file.data.exercises.length} definitions</span>
        </summary>
        {file.data.exercises.map((e) => (
          <div className="library-targets" key={e.id}>
            <strong>{e.name}</strong>
            <p className="small-text">
              {e.equipment} · {e.defaultSets} sets · {e.repMin}–{e.repMax} reps · {e.restSeconds}s
              rest
            </p>
            <p className="small-text">
              {file.data.mappings
                .filter((m) => m.exerciseId === e.id)
                .map((m) => `${muscleName(m.muscle)} (${m.role})`)
                .join(' · ')}
            </p>
            {e.notes && <p className="library-notes">{e.notes}</p>}
          </div>
        ))}
      </details>
    </div>
  );
}

function ShareLibraryDialog({
  selection,
  onClose,
}: {
  selection: LibrarySelection;
  onClose: () => void;
}) {
  const { data, run, toast } = useApp();
  const [notes, setNotes] = useState(false);
  const [loads, setLoads] = useState(false);
  let file: LibraryFile | undefined;
  let error = '';
  try {
    file = createLibrary(data, selection, { notes, loads });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const json = file ? JSON.stringify(file, null, 2) : '';
  const filename = `form-library-${
    (file?.title || 'library')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'library'
  }.json`;
  const shareFile = new File([json], filename, { type: 'application/json' });
  const canShare = Boolean(navigator.canShare?.({ files: [shareFile] }));
  return (
    <Modal title="Share library content" onClose={onClose} wide>
      <p>
        Send exercises, routines or programmes to another FORM user. Routines include their exercise
        definitions and muscle mappings.
      </p>
      <p className="library-callout">
        Workout history, completed sets, measurements and settings are excluded.
      </p>
      <div className="library-options">
        <label className="check-label">
          <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} />
          Include library notes and descriptions
        </label>
        <label className="check-label">
          <input type="checkbox" checked={loads} onChange={(e) => setLoads(e.target.checked)} />
          Include target weights
        </label>
      </div>
      <p className="small-text">
        Review any notes before sharing. Rep targets, rest times, groups and weekly schedules are
        included; the recipient chooses whether to use the schedule.
      </p>
      {error && <p role="alert">{error}</p>}
      {file && (
        <>
          <h3>{file.title}</h3>
          <LibraryContents file={file} />
        </>
      )}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button
          disabled={!file}
          onClick={() => {
            download(json, filename);
            toast('Library file export requested');
          }}
        >
          <Download size={16} />
          Download library file
        </Button>
        {canShare && (
          <AsyncButton
            disabled={!file}
            onAction={() =>
              run(async () => {
                try {
                  await navigator.share({ files: [shareFile], title: file?.title });
                } catch (e) {
                  if (!(e instanceof Error && e.name === 'AbortError')) throw e;
                }
              })
            }
          >
            <Share2 size={16} />
            Share file
          </AsyncButton>
        )}
      </div>
    </Modal>
  );
}

function ImportLibraryDialog({ onClose }: { onClose: () => void }) {
  const { data, run, toast } = useApp();
  const [file, setFile] = useState<LibraryFile>();
  const [schedule, setSchedule] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const request = useRef(0);
  const preview = file ? previewLibrary(file, data, schedule) : undefined;
  return (
    <Modal title="Import to library" onClose={onClose} wide>
      <p>
        Choose a FORM library file someone shared with you. Preview everything before adding it to
        your library.
      </p>
      <ImportPrompt kind="library" />
      <Field
        label="Choose a library file"
        hint="FORM library JSON · up to 10 MB. Other apps’ exports need conversion first."
      >
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const token = ++request.current;
            const selected = e.target.files?.[0];
            setFile(undefined);
            setError('');
            setSchedule(false);
            setReading(false);
            if (!selected) return;
            setReading(true);
            try {
              if (selected.size > LIBRARY_LIMIT)
                throw Error('Library files must be smaller than 10 MB.');
              const parsed = parseLibrary(await selected.text());
              if (token === request.current) setFile(parsed);
            } catch (e) {
              if (token === request.current) setError(e instanceof Error ? e.message : String(e));
            } finally {
              if (token === request.current) setReading(false);
            }
          }}
        />
      </Field>
      {reading && <p role="status">Reading library file…</p>}
      {error && <p role="alert">{error} Nothing was imported.</p>}
      {file && preview && (
        <>
          <h3>{file.title}</h3>
          <p className="library-callout" role="status">
            {preview.added} to add · {preview.reused} already in your library
          </p>
          <p className="small-text">
            Matching exercises are reused by name, equipment and tracking type. Existing
            definitions, notes, routines and schedules are kept. Different routine targets are added
            as a separate routine.
          </p>
          {file.data.routines.some((r) => r.weekdays.length) && (
            <label className="check-label library-schedule">
              <input
                type="checkbox"
                checked={schedule}
                onChange={(e) => setSchedule(e.target.checked)}
              />
              Use shared weekly schedules for new routines
            </label>
          )}
          <details className="library-detail">
            <summary>
              What will change<span>{preview.rows.length} library items</span>
            </summary>
            <ul className="library-import-list">
              {preview.rows.map((r, i) => (
                <li key={i}>
                  <span>
                    <strong>{r.name}</strong>
                    <small>{r.kind}</small>
                  </span>
                  <Badge>{r.action === 'add' ? 'Add' : 'Keep existing'}</Badge>
                </li>
              ))}
            </ul>
          </details>
          <LibraryContents file={file} />
        </>
      )}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <AsyncButton
          disabled={!file || !preview?.added || reading}
          onAction={() =>
            run(async () => {
              const result = await importLibrary(file!, schedule);
              toast(`${result.added} library items added · ${result.reused} existing items kept`);
              onClose();
            })
          }
        >
          <Upload size={16} />
          Add to library
        </AsyncButton>
      </div>
    </Modal>
  );
}

export function ShareLibraryButton({
  selection,
  label,
}: {
  selection: LibrarySelection;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.currentTarget.focus();
          setOpen(true);
        }}
      >
        <Share2 size={16} />
      </Button>
      {open && <ShareLibraryDialog selection={selection} onClose={() => setOpen(false)} />}
    </>
  );
}
export function LibraryActions() {
  const [open, setOpen] = useState<'share' | 'import'>();
  return (
    <>
      <Button
        variant="secondary"
        onClick={(e) => {
          e.currentTarget.focus();
          setOpen('import');
        }}
      >
        <Upload size={16} />
        Import to library
      </Button>
      <Button
        variant="secondary"
        onClick={(e) => {
          e.currentTarget.focus();
          setOpen('share');
        }}
      >
        <Share2 size={16} />
        Share library
      </Button>
      {open === 'share' && (
        <ShareLibraryDialog selection={{ kind: 'library' }} onClose={() => setOpen(undefined)} />
      )}
      {open === 'import' && <ImportLibraryDialog onClose={() => setOpen(undefined)} />}
    </>
  );
}
