import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Play, Sparkles } from 'lucide-react';
import { useApp, go } from '../lib/context';
import { dateKey, dateLabel, fmt, fromKg } from '../lib/calc';
import { sessionChoices, type SessionSuggestion } from '../lib/suggestions';
import {
  buildCindySession,
  buildFullBodySession,
  improveRoutineSession,
  swapSuggestedExercise,
} from '../lib/session-builder';
import { defaultSuggestionPreferences, type Readiness } from '../lib/suggestion-preferences';
import { startSuggestedSession } from '../lib/actions';
import type { Item, PlannedSet } from '../lib/model';
import { SuggestionPreferences } from './SuggestionPreferences';
import { AsyncButton, Badge, Button, Card, Empty, Field, Modal } from './ui';

const changeLabel = {
  weight: 'Increase weight',
  reps: 'Build reps',
  hold: 'Hold & review',
  baseline: 'Set a baseline',
  unchanged: 'Keep targets',
};

export function SessionSuggestionCard({ buttonOnly = false }: { buttonOnly?: boolean }) {
  const { data, streak } = useApp();
  const [open, setOpen] = useState(false);
  const choices = useMemo(() => sessionChoices(data), [data, streak.today]);
  const choice = choices[0];
  const trigger = (
    <Button
      variant="secondary"
      onClick={(e) => {
        e.currentTarget.focus();
        setOpen(true);
      }}
    >
      <Sparkles size={16} />
      <span>Suggest session</span>
      {!buttonOnly && <ArrowUpRight size={16} />}
    </Button>
  );
  return (
    <>
      {buttonOnly ? (
        trigger
      ) : (
        <Card className="session-suggestion-card">
          <span className="session-suggestion-icon" aria-hidden="true">
            <Sparkles size={23} />
          </span>
          <div>
            <h2>Your next session</h2>
            <p>
              {choice
                ? `${choice.source.name}${choice.date ? ` · ${dateLabel(choice.date + 'T12:00:00')}` : ''}. Progress your routine or build a balanced session.`
                : 'Build a balanced session, choose a routine or try Cindy.'}
            </p>
          </div>
          {trigger}
        </Card>
      )}
      {open && <SuggestionDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SuggestionDialog({ onClose }: { onClose: () => void }) {
  const { data, run, streak, toast } = useApp();
  const [at] = useState(Date.now);
  const [prefs, setPrefs] = useState(() =>
    structuredClone(data.settings.suggestions ?? defaultSuggestionPreferences),
  );
  const [readiness, setReadiness] = useState<Readiness>('normal');
  const [selected, setSelected] = useState('');
  const [seed, setSeed] = useState(0);
  const [locks, setLocks] = useState<Record<string, Item>>({});
  const [generationLocks, setGenerationLocks] = useState<Record<string, Item>>({});
  const [custom, setCustom] = useState<{ key: string; value: SessionSuggestion }>();
  const choices = useMemo(() => sessionChoices(data, at), [data, at]);
  const choice = choices.find((c) => c.key === selected) || choices[0];
  const generated = useMemo(
    () =>
      prefs.mode === 'full_body'
        ? buildFullBodySession(data, prefs, readiness, at, seed, generationLocks)
        : prefs.mode === 'cindy'
          ? buildCindySession(data, prefs, at)
          : choice
            ? improveRoutineSession(data, choice, prefs, readiness, at)
            : undefined,
    [data, prefs, readiness, at, seed, generationLocks, choice],
  );
  const previewKey = JSON.stringify(generated?.source);
  const suggestion = custom && custom.key === previewKey ? custom.value : generated;
  const sourceChoice = suggestion?.choice;
  const active = data.sessions.find((s) => s.status === 'active');
  const restToday = data.plans.some((p) => p.date === dateKey(new Date(at)) && p.status === 'rest');
  const changePreferences = (next: typeof prefs) => {
    setPrefs(next);
    setLocks({});
    setGenerationLocks({});
    setCustom(undefined);
  };
  const describe = (set: PlannedSet, tracking: string) => {
    if (tracking === 'duration') return `${fmt(set.durationSeconds || 0)} sec`;
    if (tracking === 'distance')
      return `${fmt(set.distanceM || 0)} m${set.durationSeconds ? ` · ${fmt(set.durationSeconds)} sec` : ''}`;
    const load =
      set.loadKg === undefined
        ? 'Choose load'
        : `${fmt(fromKg(set.loadKg, data.settings.unit), 2)} ${data.settings.unit}`;
    return `${tracking === 'bodyweight' ? '' : load + (tracking === 'assisted' ? ' assistance · ' : ' · ')}${set.reps === undefined ? 'Choose reps' : `${fmt(set.reps)} reps`}`;
  };
  return (
    <Modal title="Suggested session" onClose={onClose} wide className="session-suggestion-modal">
      <p>Review your session before starting.</p>
      <div className="form-grid suggestion-primary-controls">
        <Field label="Suggestion type">
          <select
            value={prefs.mode}
            onChange={(e) =>
              changePreferences({ ...prefs, mode: e.target.value as typeof prefs.mode })
            }
          >
            <option value="routine">Progress a routine</option>
            <option value="full_body">Build full body · push, pull, legs</option>
            <option value="cindy">Cindy · benchmark circuit</option>
          </select>
        </Field>
        {prefs.mode !== 'cindy' && (
          <>
            <Field label="Time available">
              <select
                value={prefs.timeMinutes}
                onChange={(e) => changePreferences({ ...prefs, timeMinutes: +e.target.value })}
              >
                {[...new Set([10, 15, 20, 30, 45, 60, 75, 90, 120, 180, prefs.timeMinutes])]
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n} minutes
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="How I feel today">
              <select
                value={readiness}
                onChange={(e) => {
                  setReadiness(e.target.value as Readiness);
                  setLocks({});
                  setCustom(undefined);
                }}
              >
                <option value="normal">As usual</option>
                <option value="low_energy">Low energy</option>
                <option value="tired_grip">Tired grip</option>
                <option value="sore_legs">Sore legs</option>
              </select>
            </Field>
          </>
        )}
      </div>
      {prefs.mode === 'routine' && choice && (
        <Field label="Session to suggest">
          <select
            value={choice.key}
            onChange={(e) => {
              setSelected(e.target.value);
              setCustom(undefined);
            }}
          >
            {choices.map((c) => (
              <option key={c.key} value={c.key}>
                {c.source.name} ·{' '}
                {c.kind === 'planned'
                  ? 'Scheduled'
                  : c.kind === 'weekly'
                    ? 'Weekly schedule'
                    : 'Choose a routine'}
                {c.date
                  ? ` · ${dateLabel(c.date + 'T12:00:00', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
      <SuggestionPreferences value={prefs} onChange={changePreferences} />
      {restToday && (
        <p className="callout">
          Today is a planned rest day. You can preview a future session here and start it when
          you’re ready.
        </p>
      )}
      {!suggestion ? (
        <Empty
          title="Choose your first routine"
          action={
            <div className="inline-actions">
              <Button onClick={() => go('routines?new=1')}>Create a routine</Button>
              <Button
                variant="secondary"
                onClick={() => changePreferences({ ...prefs, mode: 'full_body' })}
              >
                Build a full-body session
              </Button>
            </div>
          }
        >
          Add exercises to a routine, or build a session directly from your exercise library.
        </Empty>
      ) : (
        <>
          <div className="session-suggestion-heading">
            <div>
              <Badge>
                {sourceChoice?.kind === 'generated'
                  ? 'PUSH · PULL · LEGS'
                  : sourceChoice?.kind === 'benchmark'
                    ? 'BENCHMARK'
                    : sourceChoice?.kind === 'routine'
                      ? 'ROUTINE'
                      : 'FROM YOUR SCHEDULE'}
              </Badge>
              <h3>{suggestion.source.name}</h3>
            </div>
            {sourceChoice?.date && (
              <span>
                <CalendarDays size={15} />
                {dateLabel(sourceChoice.date + 'T12:00:00', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            )}
          </div>
          {prefs.mode === 'routine' && !suggestion.source.benchmark && (
            <p className="muted" data-testid="session-comparison">
              {suggestion.previous
                ? `Compared with ${suggestion.previous.name} on ${dateLabel(suggestion.previous.startAt, { day: 'numeric', month: 'short', year: 'numeric' })}.`
                : 'No completed session of this routine yet. Start from its planned targets to establish a baseline.'}
            </p>
          )}
          {suggestion.estimatedMinutes !== undefined && (
            <p className="small-text muted">
              {suggestion.source.benchmark
                ? `${suggestion.source.benchmark.durationSeconds / 60}-minute AMRAP · rounds + additional reps`
                : `About ${suggestion.estimatedMinutes} minutes including rests and transitions. Actual pace varies.`}
            </p>
          )}
          {suggestion.source.benchmark ? (
            <p className="callout">
              {suggestion.source.benchmark.variant === 'standard'
                ? 'Repeat 5 pull-ups → 10 push-ups → 15 air squats for 20 minutes.'
                : `Repeat ${suggestion.source.items.map((item, index) => `${suggestion.source.benchmark!.reps[index]} ${item.name}`).join(' → ')} for ${suggestion.source.benchmark.durationSeconds / 60} minutes.`}{' '}
              The sequence stays locked. Log your circuit score separately from strength sets;
              progression and coverage balancing do not change Cindy.
            </p>
          ) : (
            prefs.mode === 'full_body' && (
              <p className="callout">
                Core push, pull and legs. Accessories follow your priorities and recent recorded
                work.
              </p>
            )
          )}
          {!!suggestion.warnings?.length && (
            <div className="callout" role="status">
              {[...new Set(suggestion.warnings)].map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          {prefs.mode === 'full_body' && (
            <Button
              variant="secondary"
              onClick={() => {
                setCustom(undefined);
                setGenerationLocks(locks);
                setSeed((n) => n + 1);
              }}
            >
              Regenerate unlocked exercises
            </Button>
          )}
          <div className="session-exercise-suggestions">
            {suggestion.exercises.map((exercise, index) => (
              <section
                className="session-exercise-suggestion"
                key={exercise.item.id}
                aria-label={`${exercise.item.name} suggestion`}
              >
                <div className="session-exercise-heading">
                  <h4>{exercise.item.name}</h4>
                  <Badge>{changeLabel[exercise.change]}</Badge>
                </div>
                {prefs.explainChoices && exercise.selectionReason && (
                  <p className="suggestion-selection-reason">{exercise.selectionReason}</p>
                )}
                <p>{exercise.reason}</p>
                {exercise.slot && (
                  <div className="suggestion-exercise-controls">
                    <label>
                      <input
                        type="checkbox"
                        checked={!!locks[exercise.slotKey!]}
                        onChange={(e) =>
                          setLocks((current) => {
                            const next = { ...current };
                            if (e.target.checked) next[exercise.slotKey!] = exercise.item;
                            else delete next[exercise.slotKey!];
                            return next;
                          })
                        }
                      />
                      Keep {exercise.item.name}
                    </label>
                    <Button
                      variant="ghost"
                      disabled={!!locks[exercise.slotKey!]}
                      onClick={() => {
                        const next = swapSuggestedExercise(
                          data,
                          suggestion,
                          index,
                          prefs,
                          readiness,
                          at,
                        );
                        setCustom({ key: previewKey, value: next });
                        if (next.exercises[index].item.exerciseId === exercise.item.exerciseId)
                          toast('No alternative fits this slot and your current preferences');
                      }}
                    >
                      Replace exercise
                    </Button>
                  </div>
                )}
                {!suggestion.source.benchmark && (
                  <div className="session-target-comparison">
                    <div>
                      <span>LAST WORKING SETS</span>
                      {exercise.previous.length ? (
                        <ul>
                          {exercise.previous.map((set, i) => (
                            <li key={set.id}>
                              Set {i + 1} · {describe(set, exercise.item.tracking)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No comparable sets</p>
                      )}
                    </div>
                    <div>
                      <span>SUGGESTED TARGETS</span>
                      <ul>
                        {exercise.item.sets.map((set, i) => (
                          <li key={i}>
                            {set.label === 'warmup' ? 'Warm-up' : `Set ${i + 1}`} ·{' '}
                            {describe(set, exercise.item.tracking)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>
          {active && (
            <p className="callout">
              {active.name} is already active. Resume or finish it before starting another session.
            </p>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>
              Close preview
            </Button>
            {active ? (
              <Button onClick={() => go('workout')}>
                <Play size={16} />
                Resume workout
              </Button>
            ) : (
              <AsyncButton
                disabled={suggestion.blocked}
                onAction={() =>
                  run(async () => {
                    await startSuggestedSession(suggestion);
                    onClose();
                    go('workout');
                  })
                }
              >
                <Play size={16} />
                {sourceChoice?.date && sourceChoice.date > streak.today
                  ? 'Start now with these targets'
                  : 'Start suggested session'}
              </AsyncButton>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
