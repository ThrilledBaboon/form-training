import { useMemo, useState } from 'react';
import { Plus, Scale, Pencil, Trash2, Download, TrendingUp } from 'lucide-react';
import { useApp } from '../lib/context';
import { db } from '../lib/db';
import { saveBodyweight, saveSettings } from '../lib/actions';
import { uid, now, type Bodyweight } from '../lib/model';
import { fromKg, toKg, fmt, bodyweightTrend, dateLabel, dateKey } from '../lib/calc';
import { csvExport, download } from '../lib/backup';
import {
  Button,
  AsyncButton,
  Card,
  PageTitle,
  Metric,
  Field,
  Modal,
  SectionTitle,
  Empty,
} from '../components/ui';
import { AddToPage } from '../components/WorkspaceControls';
import { TrendChart } from '../components/Chart';
import { WeightTagFilter } from '../components/WeightTagFilter';
import {
  allWeights,
  weightTags,
  weightFilterFromValue,
  type WeightFilter,
} from '../lib/weight-tags';
export const localInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export function BodyweightForm({
  entry,
  initialTags = [],
  onClose,
}: {
  entry?: Bodyweight;
  initialTags?: string[];
  onClose: () => void;
}) {
  const { data, run } = useApp();
  const [entryId] = useState(entry?.id || uid());
  const [weight, setWeight] = useState(
    entry ? String(Number(fromKg(entry.kg, data.settings.unit).toFixed(2))) : '',
  );
  const [at, setAt] = useState(localInput(entry?.at || now()));
  const [notes, setNotes] = useState(entry?.notes || '');
  const [tags, setTags] = useState((entry?.tags ?? initialTags).join(', '));
  const suggestedTags = weightTags([
    'Fresh',
    'Gym',
    ...data.bodyweights.flatMap((e) => e.tags ?? []),
  ]);
  return (
    <Modal title={entry ? 'Edit bodyweight' : 'Log bodyweight'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await saveBodyweight({
              id: entryId,
              at: new Date(at).toISOString(),
              kg: toKg(+weight, data.settings.unit),
              notes,
              tags: weightTags(tags.split(',')),
            });
            onClose();
          }, 'Bodyweight saved');
        }}
      >
        <Field label={`Bodyweight (${data.settings.unit})`}>
          <input
            type="number"
            inputMode="decimal"
            required
            min={1}
            max={data.settings.unit === 'kg' ? 1000 : 2204}
            step="any"
            autoFocus
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
        <Field label="Date and time">
          <input
            type="datetime-local"
            required
            value={at}
            onChange={(e) => setAt(e.target.value)}
          />
        </Field>
        <Field
          label="Tags (comma separated)"
          hint="For example: Fresh, Gym, Morning. Add up to 20 tags; 40 characters each."
        >
          <input value={tags} maxLength={1000} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <div className="inline-actions" aria-label="Suggested weigh-in tags">
          {suggestedTags.map((tag) => {
            const selected = tags
              .split(',')
              .some((t) => t.trim().toLocaleLowerCase() === tag.toLocaleLowerCase());
            return (
              <Button
                key={tag}
                type="button"
                variant="secondary"
                aria-pressed={selected}
                onClick={() =>
                  setTags(
                    selected
                      ? tags
                          .split(',')
                          .filter((t) => t.trim().toLocaleLowerCase() !== tag.toLocaleLowerCase())
                          .join(', ')
                      : [...tags.split(',').filter((t) => t.trim()), tag].join(', '),
                  )
                }
              >
                {tag}
              </Button>
            );
          })}
        </div>
        <p className="small-text muted">
          Fresh can describe your usual before-food, after-toilet reading. Gym can describe a later
          reading after food, drink or training. Choose your own labels; older measurements stay
          untagged.
        </p>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save measurement</Button>
        </div>
      </form>
    </Modal>
  );
}
export function Weight() {
  const { data, run, toast, pending } = useApp();
  const [editing, setEditing] = useState<Bodyweight | 'new' | null>(null);
  const [days, setDays] = useState(
    Number(new URLSearchParams(location.hash.split('?')[1]).get('days') ?? 90),
  );
  const [override, setOverride] = useState<WeightFilter | undefined>(() => {
    const value = new URLSearchParams(location.hash.split('?')[1]).get('weighIns');
    try {
      return value ? weightFilterFromValue(value) : undefined;
    } catch {
      return undefined;
    }
  });
  const filter = override ?? data.settings.weightFilter ?? allWeights;
  const trend = useMemo(() => bodyweightTrend(data, filter), [data.bodyweights, filter]);
  const latest = trend[trend.length - 1];
  const filtered = trend.filter((e) => !days || Date.parse(e.at) >= Date.now() - days * 86400000);
  const goal = data.settings.goalKg;
  const mean = (d: number) => {
    const entries = trend.filter(
      (e) => Date.parse(e.at) >= Date.now() - d * 86400000 && Date.parse(e.at) <= Date.now(),
    );
    return entries.length ? entries.reduce((n, e) => n + e.kg, 0) / entries.length : undefined;
  };
  const week = mean(7),
    month = mean(30);
  return (
    <>
      <PageTitle
        eyebrow="THE BIGGER PICTURE"
        title="Bodyweight"
        description="A measurement is a moment. Your trend tells the story."
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus size={17} />
            Log bodyweight
          </Button>
        }
      />
      <WeightTagFilter
        disabled={pending}
        entries={data.bodyweights}
        value={filter}
        onChange={(next) => {
          setOverride(next);
          void run(() => saveSettings({ weightFilter: next }));
        }}
      />
      <p className="small-text muted">
        The filter applies to the chart, averages and history below. Changing it also sets the
        default for weight widgets; each widget can choose its own filter.
      </p>
      <div className="metric-grid">
        <Metric
          label="Latest measurement"
          value={latest ? fmt(fromKg(latest.kg, data.settings.unit)) : '—'}
          unit={data.settings.unit}
          icon={<Scale size={18} />}
          foot={latest ? dateLabel(latest.at) : 'No measurements yet'}
        />
        <Metric
          label="7-day average"
          value={week ? fmt(fromKg(week, data.settings.unit)) : '—'}
          unit={data.settings.unit}
          icon={<TrendingUp size={18} />}
          foot="Recorded measurements only"
        />
        <Metric
          label="30-day average"
          value={month ? fmt(fromKg(month, data.settings.unit)) : '—'}
          unit={data.settings.unit}
          icon={<TrendingUp size={18} />}
          foot="Recorded measurements only"
        />
        <Metric
          label="Goal"
          value={goal ? fmt(fromKg(goal, data.settings.unit)) : '—'}
          unit={data.settings.unit}
          icon={<Scale size={18} />}
          foot={
            goal && latest
              ? `${fmt(fromKg(Math.abs(goal - latest.kg), data.settings.unit))} ${data.settings.unit} from your goal`
              : 'Set a personal target below'
          }
        />
      </div>
      <Card>
        <SectionTitle
          title="Your weight over time"
          sub="Raw measurements and a trailing 7-day average."

          action={
            <select
              aria-label="Bodyweight date range"
              value={days}
              onChange={(e) => setDays(+e.target.value)}
            >
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={0}>All time</option>
            </select>
          }
        />
        <AddToPage type="bodyweight" config={{ range: { days }, weightFilter: filter }} />
        <TrendChart
          label="Bodyweight"
          zeroBaseline={false}
          unit={data.settings.unit}
          secondary="average"
          data={filtered.map((e) => ({
            date: dateLabel(e.at),
            day: dateKey(e.at),
            value: fromKg(e.kg, data.settings.unit),
            average: fromKg(e.average, data.settings.unit),
          }))}
        />
      </Card>
      <div className="two-col">
        <Card>
          <SectionTitle
            title="Measurement history"
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  download(
                    csvExport({ ...data, bodyweights: filtered }, 'bodyweight'),
                    'form-bodyweight.csv',
                    'text/csv',
                  );
                  toast('CSV download started');
                }}
              >
                <Download size={16} />
                CSV
              </Button>
            }
          />
          {!filtered.length ? (
            <Empty
              title={
                data.bodyweights.length
                  ? 'No measurements match this view'
                  : 'Make your first measurement'
              }
              compact
            >
              Choose another tag or date range, or log a measurement. Your other readings are
              retained.
            </Empty>
          ) : (
            <div className="weight-history">
              {[...filtered].reverse().map((e) => (
                <div key={e.id}>
                  <span>
                    <strong>
                      {fmt(fromKg(e.kg, data.settings.unit), 2)} <small>{data.settings.unit}</small>
                    </strong>
                    <small>
                      {dateLabel(e.at, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {e.notes && ` · ${e.notes}`}
                      {!!e.tags?.length && ` · Tags: ${e.tags.join(', ')}`}
                    </small>
                  </span>
                  <Button
                    variant="ghost"
                    aria-label="Edit measurement"
                    onClick={() => setEditing(e)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <AsyncButton
                    variant="ghost"
                    aria-label="Delete measurement"
                    onAction={() =>
                      run(async () => {
                        if (!confirm('Delete this measurement?')) return;
                        await db.bodyweights.delete(e.id);
                        toast('Measurement deleted', () => db.bodyweights.put(e));
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </AsyncButton>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle
            title="A target of your own"
            sub="Optional. Your training is more than a number."
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get('goal');
              void run(
                () =>
                  saveSettings({ goalKg: value ? toKg(+value, data.settings.unit) : undefined }),
                'Goal updated',
              );
            }}
          >
            <Field label={`Goal bodyweight (${data.settings.unit})`}>
              <input
                key={data.settings.unit + String(goal)}
                name="goal"
                type="number"
                min={1}
                max={1000}
                step="any"
                defaultValue={goal ? Number(fromKg(goal, data.settings.unit).toFixed(2)) : ''}
                placeholder="Optional"
              />
            </Field>
            <Button type="submit" variant="secondary">
              Save goal
            </Button>
          </form>
          <p className="callout">
            The average uses actual measurements from the previous 7 days. Missing days are not
            filled in. Bodyweight is only included in exercise calculations when you explicitly
            enable it for that exercise.
          </p>
        </Card>
      </div>
      {editing && (
        <BodyweightForm
          entry={editing === 'new' ? undefined : editing}
          initialTags={filter.kind === 'tag' ? [filter.tag] : []}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
