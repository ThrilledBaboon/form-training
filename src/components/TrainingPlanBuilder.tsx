import { useState } from 'react';
import { useApp } from '../lib/context';
import {
  buildTrainingPlan,
  saveTrainingPlan,
  splitNames,
  validSplits,
  defaultDays,
  type PlanChoices,
  type BuiltPlan,
} from '../lib/training-plan';
import { Button, AsyncButton, Modal, Field } from './ui';
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function TrainingPlanBuilder() {
  const { data, run, pending } = useApp();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<PlanChoices>({
    days: 3,
    split: 'full_body',
    experience: 'beginner',
    weekdays: [1, 3, 5],
  });
  const [plan, setPlan] = useState<BuiltPlan>();
  const [error, setError] = useState('');
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Generate a plan
      </Button>
      {open && (
        <Modal
          title={plan ? 'Review your training plan' : 'Build your training plan'}
          wide
          onClose={() => setOpen(false)}
        >
          <p>
            A starting template you can edit. Review the exercises and weekdays before adding it to
            your routines.
          </p>
          {!plan ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  setPlan(buildTrainingPlan(choices, data));
                  setError('');
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Could not build a plan.');
                }
              }}
            >
              <div className="form-grid">
                <Field label="Workout days per week">
                  <select
                    value={choices.days}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      const splits = validSplits(days);
                      setChoices({
                        ...choices,
                        days,
                        weekdays: defaultDays(days),
                        split: splits.includes(choices.split) ? choices.split : splits[0],
                      });
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6].map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Training split">
                  <select
                    value={choices.split}
                    onChange={(e) =>
                      setChoices({ ...choices, split: e.target.value as PlanChoices['split'] })
                    }
                  >
                    {validSplits(choices.days).map((split) => (
                      <option key={split} value={split}>
                        {splitNames[split]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Training experience">
                  <select
                    value={choices.experience}
                    onChange={(e) =>
                      setChoices({
                        ...choices,
                        experience: e.target.value as PlanChoices['experience'],
                      })
                    }
                  >
                    <option value="beginner">Starting out · 2 working sets</option>
                    <option value="regular">Training regularly · 3 working sets</option>
                  </select>
                </Field>
              </div>
              <fieldset>
                <legend>Choose {choices.days} training weekdays</legend>
                <div className="food-actions">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <label className="check-label" key={day}>
                      <input
                        type="checkbox"
                        checked={choices.weekdays.includes(day)}
                        onChange={(e) =>
                          setChoices({
                            ...choices,
                            weekdays: (e.target.checked
                              ? [...choices.weekdays, day]
                              : choices.weekdays.filter((d) => d !== day)
                            ).sort((a, b) => (a || 7) - (b || 7)),
                          })
                        }
                      />
                      {weekdays[day]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {error && <p role="alert">{error}</p>}
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Preview plan</Button>
              </div>
            </form>
          ) : (
            <>
              <h3>{plan.programme.name}</h3>
              <p>
                No working weights are prescribed. Choose a comfortable load when you train. These
                routines can be edited after saving.
              </p>
              {plan.routines.map((routine, index) => (
                <section className="card" key={routine.id}>
                  <h3>
                    {routine.name} · {weekdays[routine.weekdays[0]]}
                  </h3>
                  {routine.items.map((item, itemIndex) => (
                    <div key={item.id}>
                      <Field label={`${routine.name}: exercise ${itemIndex + 1}`}>
                        <select
                          value={item.exerciseId}
                          onChange={(e) => {
                            const exercise = data.exercises.find((ex) => ex.id === e.target.value)!;
                            setPlan({
                              ...plan,
                              routines: plan.routines.map((r, i) =>
                                i !== index
                                  ? r
                                  : {
                                      ...r,
                                      items: r.items.map((it, j) =>
                                        j !== itemIndex
                                          ? it
                                          : {
                                              ...it,
                                              exerciseId: exercise.id,
                                              name: exercise.name,
                                              tracking: exercise.tracking,
                                            },
                                      ),
                                    },
                              ),
                            });
                          }}
                        >
                          {data.exercises
                            .filter((e) => !e.archived && e.tracking === item.tracking)
                            .map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <p className="small-text muted">
                        {item.sets.length} sets ·{' '}
                        {item.tracking === 'duration' ? '30-second holds' : '8–12 reps'} ·{' '}
                        {item.restSeconds} seconds rest
                      </p>
                    </div>
                  ))}
                </section>
              ))}
              <div className="modal-actions">
                <Button variant="ghost" disabled={pending} onClick={() => setPlan(undefined)}>
                  Back to choices
                </Button>
                <AsyncButton
                  disabled={pending}
                  onAction={() =>
                    run(async () => {
                      const result = await saveTrainingPlan(plan);
                      setOpen(false);
                      setPlan(undefined);
                      return result;
                    }, 'Training plan saved in Routines')
                  }
                >
                  Save plan to routines
                </AsyncButton>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
