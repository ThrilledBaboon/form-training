import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Play, Sparkles } from 'lucide-react';
import { useApp, go } from '../lib/context';
import { dateKey, dateLabel, fmt, fromKg } from '../lib/calc';
import { sessionChoices, suggestSession } from '../lib/suggestions';
import { startSuggestedSession } from '../lib/actions';
import type { PlannedSet } from '../lib/model';
import { AsyncButton, Badge, Button, Card, Empty, Field, Modal } from './ui';

const changeLabel = {
  weight: 'Increase weight',
  reps: 'Build reps',
  hold: 'Hold & review',
  baseline: 'Set a baseline',
  unchanged: 'Keep targets',
};

export function SessionSuggestionCard({ buttonOnly = false }: { buttonOnly?: boolean }) {
  const { data, run, streak } = useApp();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const choices = useMemo(() => sessionChoices(data), [data, streak.today]);
  const choice = choices.find((c) => c.key === selected) || choices[0];
  const suggestion = useMemo(
    () => choice && suggestSession(data, choice),
    [data, choice, streak.today],
  );
  const active = data.sessions.find((s) => s.status === 'active');
  const restToday = data.plans.some((p) => p.date === dateKey(new Date()) && p.status === 'rest');
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
  const trigger = (
    <Button
      variant="secondary"
      onClick={(e) => {
        e.currentTarget.focus();
        setSelected(choices[0]?.key || '');
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
                ? `${choice.source.name}${choice.date ? ` · ${dateLabel(choice.date + 'T12:00:00')}` : ''}. Review targets based on your last session of this routine.`
                : 'Choose a routine and build a plan from your training history.'}
            </p>
          </div>
          {trigger}
        </Card>
      )}
      {open && (
        <Modal
          title="Suggested session"
          onClose={() => setOpen(false)}
          wide
          className="session-suggestion-modal"
        >
          {!suggestion ? (
            <Empty
              title="Choose your first routine"
              action={<Button onClick={() => go('routines?new=1')}>Create a routine</Button>}
            >
              Add exercises to a routine, then schedule it or return here to review your next
              session.
            </Empty>
          ) : (
            <>
              <p>
                Review your suggested targets before starting. Every set stays editable during your
                workout.
              </p>
              {restToday && (
                <p className="callout">
                  Today is a planned rest day. You can preview a future session here and start it
                  when you’re ready.
                </p>
              )}
              <Field label="Session to suggest">
                <select value={choice.key} onChange={(e) => setSelected(e.target.value)}>
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
              <div className="session-suggestion-heading">
                <div>
                  <Badge>{choice.kind === 'routine' ? 'ROUTINE' : 'FROM YOUR SCHEDULE'}</Badge>
                  <h3>{choice.source.name}</h3>
                </div>
                {choice.date && (
                  <span>
                    <CalendarDays size={15} />
                    {dateLabel(choice.date + 'T12:00:00', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                )}
              </div>
              <p className="muted" data-testid="session-comparison">
                {suggestion.previous
                  ? `Compared with ${suggestion.previous.name} on ${dateLabel(suggestion.previous.startAt, { day: 'numeric', month: 'short', year: 'numeric' })}.`
                  : 'No completed session of this routine yet. Start from its planned targets to establish a baseline.'}
              </p>
              <div className="session-exercise-suggestions">
                {suggestion.exercises.map((exercise) => (
                  <section
                    className="session-exercise-suggestion"
                    key={exercise.item.id}
                    aria-label={`${exercise.item.name} suggestion`}
                  >
                    <div className="session-exercise-heading">
                      <h4>{exercise.item.name}</h4>
                      <Badge>{changeLabel[exercise.change]}</Badge>
                    </div>
                    <p>{exercise.reason}</p>
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
                  </section>
                ))}
              </div>
              <p className="callout">
                Starting uses this reviewed copy. Your saved routine, scheduled targets and
                completed workouts keep their existing values. Load increases use your progression
                settings; warm-ups, time and distance targets are preserved.
              </p>
              {active && (
                <p className="callout">
                  {active.name} is already active. Resume or finish it before starting another
                  session.
                </p>
              )}
              <div className="modal-actions">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Close preview
                </Button>
                {active ? (
                  <Button onClick={() => go('workout')}>
                    <Play size={16} />
                    Resume workout
                  </Button>
                ) : (
                  <AsyncButton
                    onAction={() =>
                      run(async () => {
                        await startSuggestedSession(suggestion);
                        setOpen(false);
                        go('workout');
                      })
                    }
                  >
                    <Play size={16} />
                    {choice.date && choice.date > streak.today
                      ? 'Start now with these targets'
                      : 'Start suggested session'}
                  </AsyncButton>
                )}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
