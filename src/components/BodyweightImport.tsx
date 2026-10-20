import { useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/context';
import { dateLabel, fmt, fromKg } from '../lib/calc';
import {
  bodyweightFileLimit,
  importBodyweightFile,
  parseBodyweightFile,
  previewBodyweightImport,
  type BodyweightFile,
} from '../lib/bodyweight-file';
import { AsyncButton, Button, Field, Modal } from './ui';
import { ImportPrompt } from './ImportPrompt';

export function BodyweightImport({ onClose }: { onClose: () => void }) {
  const { data, run, toast } = useApp();
  const [file, setFile] = useState<BodyweightFile>();
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [tags, setTags] = useState('');
  const readVersion = useRef(0);
  const preview = useMemo(() => {
    if (!file) return undefined;
    try {
      return { rows: previewBodyweightImport(file, data.bodyweights, tags.split(',')) };
    } catch {
      return {
        error: 'Check the additional tags: at most 20 per measurement, 40 characters each.',
      };
    }
  }, [file, data.bodyweights, tags]);
  const rows = preview?.rows ?? [];
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  const dates = rows.map((row) => row.entry.at).sort();
  return (
    <Modal title="Import bodyweight" onClose={onClose} wide>
      <p>
        Choose a FORM bodyweight JSON file and review the measurements below. Use Get prompt to
        convert a scale export, spreadsheet or notes with your preferred AI tool.
      </p>
      <ImportPrompt kind="bodyweight" />
      <Field label="Choose bodyweight JSON">
        <input
          type="file"
          accept=".json,application/json"
          disabled={reading}
          onChange={async (event) => {
            const upload = event.target.files?.[0];
            const version = ++readVersion.current;
            setFile(undefined);
            setError('');
            if (!upload) return;
            setReading(true);
            try {
              if (upload.size > bodyweightFileLimit)
                throw Error('Choose a file smaller than 10 MB.');
              const parsed = parseBodyweightFile(await upload.text());
              if (version === readVersion.current) setFile(parsed);
            } catch (cause) {
              if (version === readVersion.current)
                setError(cause instanceof Error ? cause.message : 'Could not read this file.');
            } finally {
              if (version === readVersion.current) setReading(false);
            }
          }}
        />
      </Field>
      {reading && <p role="status">Reading measurements…</p>}
      {error && <p role="alert">{error}</p>}
      {file && (
        <>
          <Field
            label="Additional tags (comma separated)"
            hint="Optional. Add a label such as Fresh or Gym to every imported measurement. File tags are kept."
          >
            <input value={tags} maxLength={1000} onChange={(e) => setTags(e.target.value)} />
          </Field>
          {preview?.error && <p role="alert">{preview.error}</p>}
          {!!rows.length && (
            <>
              <p role="status">
                {count('new')} new · {count('duplicate')} duplicates skipped · {count('conflict')}{' '}
                conflicts skipped
              </p>
              <p className="small-text muted">
                {dateLabel(dates[0], { day: 'numeric', month: 'short', year: 'numeric' })} to{' '}
                {dateLabel(dates.at(-1)!, { day: 'numeric', month: 'short', year: 'numeric' })}.
                Existing readings, tags and notes are kept. Conflicts have different weights at the
                same instant; correct those in your file before importing them.
              </p>
              <div
                className="bodyweight-import-preview"
                tabIndex={0}
                role="region"
                aria-label="Measurement preview"
              >
                <table>
                  <caption className="sr-only">
                    Bodyweight import preview in your display unit and local timezone
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date and time</th>
                      <th scope="col">Weight ({data.settings.unit})</th>
                      <th scope="col">Tags and notes</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ entry, status }, index) => (
                      <tr key={index}>
                        <td>
                          {dateLabel(entry.at, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td>{fmt(fromKg(entry.kg, data.settings.unit), 2)}</td>
                        <td>
                          {entry.tags?.join(', ')}
                          {entry.notes && <p>{entry.notes}</p>}
                        </td>
                        <td>
                          {status === 'new'
                            ? 'New'
                            : status === 'duplicate'
                              ? 'Duplicate — skipped'
                              : 'Conflict — skipped'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <AsyncButton
          disabled={!file || !!preview?.error || count('new') === 0 || reading}
          onAction={() =>
            run(async () => {
              if (!file) return;
              const result = await importBodyweightFile(file, tags.split(','));
              toast(
                `Imported ${result.added} measurements; skipped ${result.duplicates} duplicates and ${result.conflicts} conflicts.`,
              );
              onClose();
            })
          }
        >
          Import {count('new')} measurements
        </AsyncButton>
      </div>
    </Modal>
  );
}
