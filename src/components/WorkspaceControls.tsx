import { useEffect, useState } from 'react';
import { useApp } from '../lib/context';
import {
  defaultWorkspace,
  systemNames,
  makeWidget,
  WidgetSchema,
  type Widget,
  type ViewRange,
} from '../lib/workspace-model';
import { changeWorkspace, savePage, setSystemEnabled } from '../lib/workspace';
import { MUSCLES, muscleName, trackingTypes } from '../lib/model';
import { fromKg, toKg, dateKey } from '../lib/calc';
import { Card, SectionTitle, Button, AsyncButton, Field, Modal } from './ui';
import { WIDGETS, widgetDefinition } from './Widgets';
import { ChartPreferences } from './ChartPreferences';
import { personalisation, destinations, type Destination } from '../lib/personalisation';
import { widgetPresentation } from '../lib/page-design';
import { WeightTagFilter } from './WeightTagFilter';
import { allWeights } from '../lib/weight-tags';

export function SystemSettings() {
  const { data, run, pending } = useApp();
  const w = data.workspace ?? defaultWorkspace();
  const [systems, setSystems] = useState(w.systems);
  useEffect(
    () => setSystems(w.systems),
    [
      w.systems.gym,
      w.systems.food,
      w.systems.climbing,
      w.systems['rocket-league'],
      w.systems.football,
    ],
  );
  return (
    <Card>
      <SectionTitle
        title="Systems"
        sub="Show the tools you use. Turning a system off preserves all records, drafts and page positions."
      />
      {(['gym', 'climbing', 'food', 'rocket-league', 'football'] as const).map((system) => (
        <label className="system-switch" key={system}>
          <span>
            <strong>{systemNames[system]}</strong>
            <small>
              {system === 'gym'
                ? 'Workouts, routines and training insights'
                : system === 'food'
                  ? 'Recipes, diary, kitchen, shopping and spending'
                  : system === 'climbing'
                    ? 'Climb library, mixed sessions, projects and climbing insights'
                    : system === 'football'
                      ? 'Keepy-ups, cone courses, shooting, passing and practice results'
                      : 'Drills, timed warm-ups, training packs and practice results'}
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label={'Enable ' + systemNames[system] + ' system'}
            checked={systems[system]}
            disabled={pending}
            onChange={(e) => {
              const enabled = e.target.checked;
              setSystems((current) => ({ ...current, [system]: enabled }));
              void run(
                async () => {
                  try {
                    await setSystemEnabled(system, enabled);
                  } catch (error) {
                    setSystems(w.systems);
                    throw error;
                  }
                },
                enabled ? 'System enabled' : 'System hidden; your data is retained',
              );
            }}
          />
        </label>
      ))}
      {!w.systems.gym && data.sessions.some((s) => s.status === 'active') && (
        <p className="callout">
          Your active workout is still saved. Enable Gym to resume it; its timer deadline has been
          preserved.
        </p>
      )}
      <p className="small-text muted">
        Custom pages, bodyweight, settings and complete backups remain available. Backups include
        all systems even when hidden.
      </p>
    </Card>
  );
}
export function RangeControls({
  value,
  onChange,
  label = 'Date range',
}: {
  value: ViewRange;
  onChange: (r: ViewRange) => void;
  label?: string;
}) {
  const custom = !!(value.from || value.to);
  return (
    <div className="widget-range-controls">
      <Field label={label}>
        <select
          value={custom ? 'custom' : String(value.days)}
          onChange={(e) =>
            onChange(
              e.target.value === 'custom'
                ? {
                    days: 0,
                    from: dateKey(new Date(Date.now() - 30 * 86400000)),
                    to: dateKey(new Date()),
                  }
                : { days: +e.target.value },
            )
          }
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
          <option value="0">All time</option>
          <option value="custom">Custom dates</option>
        </select>
      </Field>
      {custom && (
        <>
          <Field label="From">
            <input
              type="date"
              value={value.from ?? ''}
              max={value.to}
              onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
            />
          </Field>
          <Field label="Through">
            <input
              type="date"
              value={value.to ?? ''}
              min={value.from}
              onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
            />
          </Field>
        </>
      )}
    </div>
  );
}
export function WidgetEditor({
  widget,
  sections,
  onSave,
  onClose,
}: {
  widget: Widget;
  sections?: { id: string; title: string }[];
  onSave: (w: Widget) => Promise<unknown>;
  onClose: () => void;
}) {
  const { data, run } = useApp();
  const [draft, setDraft] = useState(() => structuredClone(widget));
  const c = draft.config;
  const look = widgetPresentation(draft);
  const present = (value: Partial<NonNullable<Widget['presentation']>>) =>
    setDraft({
      ...draft,
      presentation: { ...look, ...value } as NonNullable<Widget['presentation']>,
    });
  const meta = widgetDefinition(draft.type);
  const patch = (p: Partial<Widget['config']>) => setDraft({ ...draft, config: { ...c, ...p } });
  const exerciseView = draft.type.startsWith('exercise');
  const muscle = draft.type.startsWith('muscle');
  const number = (key: 'repMin' | 'repMax' | 'loadMinKg' | 'loadMaxKg', label: string) => (
    <Field label={label}>
      <input
        type="number"
        min="0"
        step="any"
        value={
          c[key] === undefined
            ? ''
            : key.startsWith('load')
              ? fromKg(c[key]!, data.settings.unit)
              : c[key]
        }
        onChange={(e) =>
          patch({
            [key]:
              e.target.value === ''
                ? undefined
                : key.startsWith('load')
                  ? toKg(+e.target.value, data.settings.unit)
                  : +e.target.value,
          })
        }
      />
    </Field>
  );
  return (
    <Modal title="Configure widget" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await onSave(WidgetSchema.parse(draft));
            onClose();
          });
        }}
      >
        <p>
          {meta?.[2] ??
            'This widget is unavailable in this version. Its settings and position are preserved.'}
        </p>
        <Field label="Widget title (optional)">
          <input
            maxLength={150}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Field>
        <Field label="Widget size">
          <select
            value={draft.size}
            onChange={(e) => setDraft({ ...draft, size: e.target.value as Widget['size'] })}
          >
            <option value="compact">Compact</option>
            <option value="half">Half width</option>
            <option value="wide">Full width</option>
          </select>
        </Field>
        <details>
          <summary>Appearance & phone layout</summary>
          <Field label="Widget accent">
            <select
              value={look.accent}
              onChange={(e) =>
                present({ accent: e.target.value as NonNullable<Widget['presentation']>['accent'] })
              }
            >
              {['theme', 'green', 'blue', 'purple', 'orange'].map((a) => (
                <option key={a} value={a}>
                  {a === 'theme' ? 'Use my theme' : a}
                </option>
              ))}
            </select>
          </Field>
          {(
            [
              ['showTitle', 'Show widget heading'],
              ['showDescription', 'Show date and status subtitle'],
              ['showExplore', 'Show Explore link'],
            ] as const
          ).map(([key, label]) => (
            <label className="check-label" key={key}>
              <input
                type="checkbox"
                checked={look[key]}
                onChange={(e) => present({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <Field label="Phone widget width">
            <select
              value={draft.phoneSize ?? 'full'}
              onChange={(e) =>
                setDraft({ ...draft, phoneSize: e.target.value as Widget['phoneSize'] })
              }
            >
              <option value="full">Full width</option>
              <option value="half">Half width</option>
            </select>
          </Field>
          <label className="check-label">
            <input
              type="checkbox"
              checked={!!look.charts}
              onChange={(e) =>
                present({
                  charts: e.target.checked
                    ? structuredClone(personalisation(data.settings).charts)
                    : undefined,
                })
              }
            />
            Use custom chart display for this widget
          </label>
          {look.charts && (
            <ChartPreferences value={look.charts} onChange={(charts) => present({ charts })} />
          )}
        </details>
        {!!sections?.length && (
          <Field label="Page section">
            <select
              value={draft.sectionId ?? ''}
              onChange={(e) => setDraft({ ...draft, sectionId: e.target.value || undefined })}
            >
              <option value="">No section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        {draft.type.startsWith('climbing-') &&
          !['climbing-start', 'climbing-week'].includes(draft.type) && (
            <details>
              <summary>Saved climbing filters</summary>
              <Field label="Climbing discipline">
                <select
                  value={c.climbingType ?? ''}
                  onChange={(e) =>
                    patch({ climbingType: (e.target.value || undefined) as typeof c.climbingType })
                  }
                >
                  <option value="">All disciplines</option>
                  {['bouldering', 'top_rope', 'auto_belay', 'lead'].map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Climbing venue filter" hint="Exact recorded venue; blank includes all.">
                <input
                  maxLength={200}
                  value={c.climbingVenue ?? ''}
                  onChange={(e) => patch({ climbingVenue: e.target.value || undefined })}
                />
              </Field>
              <Field label="Climbing tag filter" hint="One recorded tag; blank includes all.">
                <input
                  maxLength={40}
                  value={c.climbingTag ?? ''}
                  onChange={(e) => patch({ climbingTag: e.target.value || undefined })}
                />
              </Field>
            </details>
          )}
        {['bodyweight', 'weight-summary'].includes(draft.type) && (
          <>
            <label className="check-label">
              <input
                type="checkbox"
                checked={!c.weightFilter}
                onChange={(e) => patch({ weightFilter: e.target.checked ? undefined : allWeights })}
              />
              Use default bodyweight filter
            </label>
            {c.weightFilter && (
              <WeightTagFilter
                entries={data.bodyweights}
                value={c.weightFilter}
                onChange={(filter) => patch({ weightFilter: filter })}
                label="Widget weigh-in tag filter"
              />
            )}
          </>
        )}
        {draft.type === 'personal-goal' && (
          <>
            <p>
              This is a milestone you update yourself. It does not change recorded training or
              nutrition.
            </p>
            {(['goalTarget', 'goalCurrent'] as const).map((key) => (
              <Field
                key={key}
                label={key === 'goalTarget' ? 'Milestone target' : 'Milestone progress'}
              >
                <input
                  required
                  type="number"
                  min={key === 'goalTarget' ? 0.000001 : 0}
                  max={1e12}
                  step="any"
                  value={c[key] ?? (key === 'goalTarget' ? 10 : 0)}
                  onChange={(e) => patch({ [key]: Number(e.target.value) })}
                />
              </Field>
            ))}
            <Field label="Milestone unit">
              <input
                maxLength={40}
                value={c.goalUnit ?? ''}
                onChange={(e) => patch({ goalUnit: e.target.value })}
              />
            </Field>
          </>
        )}
        {draft.type === 'quick-actions' && (
          <>
            <p>Choose up to six shortcuts. Disabled systems stay hidden.</p>
            {destinations.map(([id, label]) => (
              <label className="check-label" key={id}>
                <input
                  type="checkbox"
                  checked={(c.quickLinks ?? ['workout', 'climbing-log', 'food-diary']).includes(id)}
                  onChange={(e) =>
                    patch({
                      quickLinks: e.target.checked
                        ? [...(c.quickLinks ?? ['workout', 'climbing-log', 'food-diary']), id]
                        : ((c.quickLinks ?? ['workout', 'climbing-log', 'food-diary']).filter(
                            (r) => r !== id,
                          ) as Destination[]),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </>
        )}
        {(exerciseView || draft.type === 'setups') && (
          <Field label="Widget exercise">
            <select
              value={c.exerciseId ?? ''}
              onChange={(e) =>
                patch({ exerciseId: e.target.value || undefined, setupId: undefined })
              }
            >
              <option value="">Choose an exercise</option>
              {data.exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.archived ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        {exerciseView && (
          <>
            <Field label="Comparable tracking type">
              <select
                value={c.tracking ?? ''}
                onChange={(e) =>
                  patch({ tracking: (e.target.value || undefined) as typeof c.tracking })
                }
              >
                <option value="">Current exercise type</option>
                {trackingTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Equipment context">
              <select
                value={c.setupId ?? ''}
                onChange={(e) => patch({ setupId: e.target.value || undefined })}
              >
                <option value="">All contexts (incompatible loads require a filter)</option>
                {data.workspace?.setups
                  .filter((s) => s.exerciseId === c.exerciseId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.gym}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Load convention">
              <select
                value={c.basis ?? ''}
                onChange={(e) => patch({ basis: (e.target.value || undefined) as typeof c.basis })}
              >
                <option value="">All conventions</option>
                {['unspecified', 'total', 'per_dumbbell', 'per_side'].map((v) => (
                  <option key={v} value={v}>
                    {v.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check-label">
              <input
                type="checkbox"
                checked={c.includeWarmup}
                onChange={(e) => patch({ includeWarmup: e.target.checked })}
              />
              Include warm-up sets
            </label>
            <div className="two-col">
              {number('repMin', 'Minimum reps')}
              {number('repMax', 'Maximum reps')}
              {number('loadMinKg', 'Minimum load (' + data.settings.unit + ')')}
              {number('loadMaxKg', 'Maximum load (' + data.settings.unit + ')')}
            </div>
          </>
        )}
        {(exerciseView || ['training-trend', 'macro-trend'].includes(draft.type)) && (
          <Field label="Widget metric">
            <select
              value={c.metric}
              onChange={(e) => patch({ metric: e.target.value as typeof c.metric })}
            >
              {(draft.type === 'macro-trend'
                ? ['protein', 'carbs', 'fat', 'fibre']
                : exerciseView
                  ? ['volume', 'bestLoad', 'bestMax', 'reps', 'sets', 'duration', 'distance']
                  : ['volume', 'sets', 'duration']
              ).map((m) => (
                <option key={m} value={m}>
                  {{
                    bestLoad: 'Heaviest recorded load',
                    bestMax: 'Estimated 1RM',
                    volume: 'External-load volume',
                  }[m] ?? m}
                </option>
              ))}
            </select>
          </Field>
        )}
        {muscle && (
          <>
            <Field label="Selected muscle">
              <select
                value={c.muscle}
                onChange={(e) => patch({ muscle: e.target.value as typeof c.muscle })}
              >
                {MUSCLES.map((m) => (
                  <option key={m} value={m}>
                    {muscleName(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Muscle view">
              <select
                value={c.mode}
                onChange={(e) => patch({ mode: e.target.value as typeof c.mode })}
              >
                <option value="sets">Set contributions</option>
                <option value="score">Relative volume score</option>
                <option value="recovery">Recent training / recovery estimate</option>
              </select>
            </Field>
            <label className="check-label">
              <input
                type="checkbox"
                checked={c.relative}
                onChange={(e) => patch({ relative: e.target.checked })}
              />
              Scale colours relative to busiest muscle
            </label>
          </>
        )}
        {draft.type === 'spending' && (
          <Field label="Budget period">
            <select
              value={c.spendingPeriod}
              onChange={(e) => patch({ spendingPeriod: e.target.value as 'week' | 'month' })}
            >
              <option value="week">Current week</option>
              <option value="month">Current month</option>
            </select>
          </Field>
        )}
        {draft.type === 'calendar' && (
          <>
            <Field label="Calendar intensity">
              <select
                value={c.calendarMetric}
                onChange={(e) =>
                  patch({ calendarMetric: e.target.value as typeof c.calendarMetric })
                }
              >
                {['consistency', 'sets', 'volume', 'duration'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Calendar full intensity">
              <input
                type="number"
                min={0.01}
                max={1e9}
                step="any"
                value={c.calendarMax}
                onChange={(e) => patch({ calendarMax: +e.target.value })}
              />
            </Field>
          </>
        )}
        {draft.type === 'prices' && (
          <Field label="Price-history ingredient">
            <select
              value={c.ingredientId ?? ''}
              onChange={(e) => patch({ ingredientId: e.target.value || undefined })}
            >
              <option value="">Choose an ingredient</option>
              {data.food?.ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {draft.type === 'notes' && (
          <Field label="Personal notes">
            <textarea
              rows={6}
              maxLength={10000}
              value={c.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </Field>
        )}
        {draft.type === 'shortcut' && (
          <Field label="Quick action">
            <select
              value={c.link}
              onChange={(e) => patch({ link: e.target.value as typeof c.link })}
            >
              {destinations.map(([link, label]) => (
                <option key={link} value={link}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {meta?.[4] === 'today' &&
          ['macros', 'meal-plan', 'food-programme', 'expiry'].includes(draft.type) && (
            <Field label="Specific date (blank follows today)">
              <input
                type="date"
                value={c.date ?? ''}
                onChange={(e) => patch({ date: e.target.value || undefined })}
              />
            </Field>
          )}
        {meta?.[4] === 'range' && (
          <>
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!c.range}
                onChange={(e) => patch({ range: e.target.checked ? { days: 90 } : undefined })}
              />
              Use this widget’s own date range
            </label>
            {c.range && (
              <RangeControls
                value={c.range}
                onChange={(range) => patch({ range })}
                label="Widget date range"
              />
            )}
          </>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save widget</Button>
        </div>
      </form>
    </Modal>
  );
}
export function AddToPage({ type, config }: { type: string; config: Partial<Widget['config']> }) {
  const { data, run } = useApp();
  const workspace = data.workspace ?? defaultWorkspace();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(workspace.homePageId);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add to page
      </Button>
      {open && (
        <Modal title="Add this view to a page" onClose={() => setOpen(false)}>
          <p>The widget keeps these filters and uses your live saved records.</p>
          <Field label="Destination page">
            <select value={id} onChange={(e) => setId(e.target.value)}>
              {workspace.pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <AsyncButton
            onAction={() =>
              run(async () => {
                const page = workspace.pages.find((p) => p.id === id);
                if (!page) throw Error('Choose an existing page.');
                await savePage(
                  { ...page, widgets: [...page.widgets, makeWidget(type, config)] },
                  page.revision,
                );
                setOpen(false);
              }, 'View added to page')
            }
          >
            Add widget to page
          </AsyncButton>
        </Modal>
      )}
    </>
  );
}

export const widgetOptions = WIDGETS;
