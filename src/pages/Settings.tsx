import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  Upload,
  ShieldCheck,
  HardDrive,
  FileJson,
  FileSpreadsheet,
  Check,
  Archive,
  Trash2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useApp } from '../lib/context';
import { db } from '../lib/db';
import { saveSettings, resetAllData } from '../lib/actions';
import {
  parseBackup,
  importPreview,
  importBackup,
  exportJSON,
  csvExport,
  download,
  type Backup,
} from '../lib/backup';
import { dateLabel, fmt } from '../lib/calc';
import { type Settings as Preferences } from '../lib/model';
import {
  Card,
  PageTitle,
  SectionTitle,
  Button,
  AsyncButton,
  Field,
  Badge,
  Modal,
} from '../components/ui';
export function Settings() {
  const { data, run, toast, pending } = useApp();
  const s = data.settings;
  const [importing, setImporting] = useState<Backup | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [storage, setStorage] = useState<string>('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetWord, setResetWord] = useState('');
  const backups = useLiveQuery(() => db.backups.orderBy('createdAt').reverse().toArray());
  const patch = (p: Partial<Preferences>) => void run(() => saveSettings(p));
  const numeric = (key: keyof Preferences, label: string, min: number, max: number, step = 1) => (
    <Field label={label} key={key}>
      <input
        key={String(s[key])}
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={s[key] as number}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== '' && n >= min && n <= max) patch({ [key]: n });
          else {
            e.target.value = String(s[key]);
            toast(`Enter a value between ${min} and ${max}.`);
          }
        }}
      />
    </Field>
  );
  return (
    <>
      <PageTitle
        eyebrow="MAKE FORM YOUR OWN"
        title="Settings & your data"
        description="A few useful preferences. Complete control over your records."
      />
      <div className="privacy-panel">
        <ShieldCheck size={26} />
        <div>
          <h2>Your training stays with you.</h2>
          <p>
            No account, no tracking, no cloud uploads. Your records live in this browser on this
            device. Other devices and browsers have separate data. Export a backup to keep an
            independent copy.
          </p>
        </div>
        <Badge>LOCAL FIRST</Badge>
      </div>
      <div className="two-col">
        <Card>
          <SectionTitle
            title="Training preferences"
            sub="Units change the display, never the meaning of a recorded set."
          />
          <div className="form-grid">
            <Field label="Weight unit">
              <select
                value={s.unit}
                onChange={(e) => patch({ unit: e.target.value as Preferences['unit'] })}
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </select>
            </Field>
            <Field label="Estimated 1RM formula">
              <select
                value={s.formula}
                onChange={(e) => patch({ formula: e.target.value as Preferences['formula'] })}
              >
                <option value="epley">Epley</option>
                <option value="brzycki">Brzycki</option>
              </select>
            </Field>
            {numeric('weightIncrement', `Weight increment (${s.unit})`, 0.1, 100, 0.1)}
            {numeric('repIncrement', 'Repetition increment', 0.5, 100, 0.5)}
            {numeric('defaultRest', 'Default rest (seconds)', 0, 3600)}
            {numeric('weekTarget', 'Weekly session target', 1, 14)}
            {numeric('progressionPercent', 'Suggested increase (%)', 0.1, 20, 0.1)}
            {numeric('progressionRpe', 'Maximum RPE for an increase', 1, 10, 0.5)}
          </div>
          <p className="small-text muted">
            Load increases are suggested after all planned working sets reach the upper rep target,
            within effort settings. Missing effort scores are treated as unknown. Recent declines
            favour maintaining your load.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={s.keepAwake}
              onChange={(e) => patch({ keepAwake: e.target.checked })}
            />
            Keep the screen awake during an active workout, where supported
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={s.sound}
              onChange={(e) => patch({ sound: e.target.checked })}
            />
            Rest timer sound
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={s.vibration}
              onChange={(e) => patch({ vibration: e.target.checked })}
            />
            Rest timer vibration, where supported
          </label>
          <p className="small-text muted">
            A suspended browser may not play sound or vibrate. Remaining time is recalculated from
            its saved deadline when you return. Native background notifications and lock-screen
            integration are not provided.
          </p>
        </Card>
        <Card>
          <SectionTitle title="Appearance & assumptions" />
          <div className="form-grid">
            <Field label="Theme">
              <select
                value={s.theme}
                onChange={(e) => patch({ theme: e.target.value as Preferences['theme'] })}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">Use device setting</option>
              </select>
            </Field>
            {numeric('primaryFactor', 'Primary muscle contribution', 0, 2, 0.1)}
            {numeric('secondaryFactor', 'Secondary muscle contribution', 0, 2, 0.1)}
            {numeric('muscleScale', 'Full muscle colour at', 1, 100, 1)}
            {numeric('recoveryHours', 'Recent-load half-life (hours)', 1, 336, 1)}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={s.reducedMotion}
              onChange={(e) => patch({ reducedMotion: e.target.checked })}
            />
            Reduce interface motion
          </label>
          <div className="callout">
            <Info size={18} />
            <p>
              Muscle scores and recovery estimates are transparent training heuristics. They do not
              measure activation, fatigue or physiological recovery. Each exercise’s muscle mapping
              can be edited in the exercise library.
            </p>
          </div>
          <SectionTitle
            title="Browser storage"
            sub="Local storage is useful. An exported file is your independent backup."
          />
          <AsyncButton
            variant="secondary"
            onAction={() =>
              run(async () => {
                if (!navigator.storage) {
                  toast('Storage management is unavailable in this browser.');
                  return;
                }
                const persistent = await navigator.storage.persist?.();
                const estimate = await navigator.storage.estimate();
                setStorage(
                  `${persistent ? 'Persistent storage granted' : 'Browser-managed storage'} · ${fmt((estimate.usage || 0) / 1048576, 2)} MB used of approximately ${fmt((estimate.quota || 0) / 1073741824, 1)} GB available.`,
                );
              })
            }
          >
            <HardDrive size={16} />
            Request durable storage
          </AsyncButton>
          {storage && (
            <p className="small-text muted" role="status">
              {storage}
            </p>
          )}
        </Card>
      </div>
      <Card>
        <SectionTitle
          title="Back up & restore"
          sub="Keep your history somewhere beyond this browser."
        />
        <div className="backup-grid">
          <div className="backup-option">
            <span className="backup-icon">
              <FileJson size={25} />
            </span>
            <h3>A complete copy</h3>
            <p>
              Export exercises, routines, plans, sessions, sets, measurements and preferences as a
              versioned JSON file.
            </p>
            <AsyncButton
              onAction={() =>
                run(
                  () => exportJSON(),
                  'Backup download requested. Check your downloads and keep the file safe.',
                )
              }
            >
              <Download size={16} />
              Export JSON backup
            </AsyncButton>
            <small>
              {s.lastBackupAt
                ? `Last file export requested: ${dateLabel(s.lastBackupAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'No file backup exported yet'}
            </small>
          </div>
          <div className="backup-option">
            <span className="backup-icon">
              <Upload size={25} />
            </span>
            <h3>Bring your history back</h3>
            <p>
              Files are validated before any data changes. Review a preview, then merge new
              identifiers or replace the database.
            </p>
            <label className="button secondary file-button">
              <Upload size={16} />
              Choose a JSON backup
              <input
                type="file"
                accept=".json,application/json"
                aria-label="Choose a JSON backup"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(async () => {
                      if (file.size > 100 * 1024 * 1024)
                        throw Error('Import files must be below 100 MB.');
                      setImporting(parseBackup(await file.text()));
                    });
                  e.target.value = '';
                }}
              />
            </label>
            <small>A local recovery snapshot is made automatically before import.</small>
          </div>
          <div className="backup-option">
            <span className="backup-icon">
              <FileSpreadsheet size={25} />
            </span>
            <h3>Take the numbers further</h3>
            <p>
              Open your records in a spreadsheet. CSV uses canonical kg, metres and seconds. JSON is
              the restore format.
            </p>
            <div className="csv-buttons">
              {(['sessions', 'sets', 'bodyweight', 'exercises'] as const).map((kind) => (
                <Button
                  key={kind}
                  variant="secondary"
                  onClick={() => {
                    download(csvExport(data, kind), `form-${kind}.csv`, 'text/csv');
                    toast('CSV download started');
                  }}
                >
                  <Download size={14} />
                  {kind === 'exercises'
                    ? 'Exercise history'
                    : kind.replace(/^./, (x) => x.toUpperCase())}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <SectionTitle
          title="Local recovery snapshots"
          sub="These share your browser storage. Download one to create an independent file backup."
        />
        {backups?.length ? (
          backups.map((b) => (
            <div className="list-line" key={b.id}>
              <span className="exercise-icon">
                <Archive size={17} />
              </span>
              <span>
                <strong>{b.reason}</strong>
                <small>
                  {dateLabel(b.createdAt, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
              </span>
              <Button
                variant="secondary"
                onClick={() => {
                  download(b.json, `form-recovery-${b.createdAt.slice(0, 10)}.json`);
                  toast('Recovery snapshot download started');
                }}
              >
                <Download size={16} />
                Download
              </Button>
              <AsyncButton
                variant="ghost"
                aria-label="Delete recovery snapshot"
                onAction={() =>
                  run(async () => {
                    if (
                      confirm(
                        'Delete this recovery snapshot? Download it first if you need a separate copy.',
                      )
                    )
                      await db.backups.delete(b.id);
                  })
                }
              >
                <Trash2 size={16} />
              </AsyncButton>
            </div>
          ))
        ) : (
          <p className="muted">
            Snapshots will appear here after an import. Your regular backups should be exported as
            files.
          </p>
        )}
      </Card>
      <Card className="reset-data-card">
        <SectionTitle title="Start fresh" sub="Reset FORM’s data in this browser." />
        <p>
          Remove your training history, measurements, custom exercises, routines, plans, preferences
          and local recovery snapshots. The starter exercise library and routines will be restored.
          Export a backup first if you want to keep a copy.
        </p>
        <Button
          variant="danger"
          onClick={() => {
            setResetWord('');
            setResetOpen(true);
          }}
        >
          <Trash2 size={16} />
          Reset all data
        </Button>
      </Card>
      <div className="settings-footer">
        <strong className="wordmark">
          FORM<span>●</span>
        </strong>
        <p>
          Independent software for your personal training.
          <br />
          Original code and illustrations. No affiliation with Setgraph.
        </p>
        <span>Version 1.0 · Database schema 2</span>
      </div>
      {resetOpen && (
        <Modal title="Reset all FORM data?" onClose={() => setResetOpen(false)}>
          <p>
            This removes all FORM records and preferences in this browser, including your active
            workout, rest timer and local recovery snapshots. It restores the original exercise
            library and starter routines. This cannot be undone without an exported backup.
          </p>
          <p>
            Only FORM’s data at this site address is removed. Downloaded files and data in other
            browser profiles or devices stay where they are. The app’s offline files are kept.
          </p>
          <p className="callout">
            Current data: {data.sessions.length} workouts · {data.sets.length} sets ·{' '}
            {data.bodyweights.length} bodyweight readings · {backups?.length || 0} recovery
            snapshots.
          </p>
          <AsyncButton variant="secondary" onAction={() => run(() => exportJSON())}>
            <Download size={16} />
            Export backup before resetting
          </AsyncButton>
          <form
            className="reset-confirm-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (resetWord !== 'RESET' || pending) return;
              void run(async () => {
                await resetAllData();
                setResetOpen(false);
                setResetWord('');
                toast('FORM has been reset. Your starter library is ready.');
              });
            }}
          >
            <Field
              label="Type RESET to confirm"
              hint="Deletes all FORM data in this browser. Exported files are kept."
            >
              <input
                value={resetWord}
                onChange={(e) => setResetWord(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </Field>
            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" type="submit" disabled={resetWord !== 'RESET'}>
                Permanently reset FORM
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {importing && (
        <Modal title="Review your backup" onClose={() => setImporting(null)} wide>
          <p>
            Exported{' '}
            {dateLabel(importing.exportedAt, { day: 'numeric', month: 'long', year: 'numeric' })} ·
            FORM schema {importing.schemaVersion}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Records</th>
                  <th>In file</th>
                  <th>Existing IDs</th>
                  <th>New IDs</th>
                </tr>
              </thead>
              <tbody>
                {importPreview(importing, data).map((row) => (
                  <tr key={row.table}>
                    <td>{row.table}</td>
                    <td>{row.total}</td>
                    <td>{row.duplicates}</td>
                    <td>{row.total - row.duplicates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Field label="Import method">
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as typeof importMode)}
            >
              <option value="merge">Merge · keep existing records, add new IDs</option>
              <option value="replace">Replace · use records from this file</option>
            </select>
          </Field>
          <p className="callout">
            {importMode === 'merge'
              ? 'Existing IDs keep their current values. Existing session snapshots and their sets stay together; they are not overwritten. Imported preferences are ignored. Repeated imports add no duplicate records.'
              : 'All current training records and preferences will be replaced. A local recovery snapshot is saved atomically before changes. Export a file first for an independent backup.'}
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setImporting(null)}>
              Cancel
            </Button>
            <AsyncButton
              variant={importMode === 'replace' ? 'danger' : 'primary'}
              onAction={() =>
                run(async () => {
                  if (
                    !confirm(
                      importMode === 'replace'
                        ? 'Replace your current database with this backup?'
                        : 'Merge the new records from this backup?',
                    )
                  )
                    return;
                  await importBackup(importing, importMode);
                  setImporting(null);
                  toast('Import complete. Your data has been restored.');
                })
              }
            >
              Confirm {importMode} import
            </AsyncButton>
          </div>
        </Modal>
      )}
    </>
  );
}
