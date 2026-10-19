import { useState } from 'react';
import { useApp } from '../lib/context';
import { uid, now, type Plan } from '../lib/model';
import { combinedWeek, saveWeekGymPlan, deleteWeekGymPlan } from '../lib/week-planner';
import { foodDay, shiftDay } from '../lib/food-calc';
import { defaultWorkspace } from '../lib/workspace-model';
import { emptyClimbing, climbTypes, climbTypeName, type ClimbingPlan } from '../lib/climbing-model';
import { saveClimbingRecord, changeClimbing } from '../lib/climbing-actions';
import { PlanEditor } from './FoodPlanner';
import { Button, AsyncButton, Card, Empty, Field, Modal, PageTitle } from '../components/ui';
function GymPlanEditor({
  date,
  initial,
  onClose,
}: {
  date: string;
  initial?: Plan;
  onClose: () => void;
}) {
  const { data, run } = useApp();
  const [routine, select] = useState(initial?.routineId ?? data.routines[0]?.id ?? '');
  const [day, setDay] = useState(initial?.date ?? date),
    [notes, setNotes] = useState(initial?.notes ?? '');
  const [rest, setRest] = useState(initial?.status === 'rest');
  const [id] = useState(initial?.id ?? uid());
  return (
    <Modal title={initial ? 'Edit training plan' : 'Plan training'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const source = data.routines.find((r) => r.id === routine);
            if (!rest && !initial && !source) throw Error('Choose a routine first.');
            await saveWeekGymPlan(
              {
                id,
                date: day,
                routineId: rest ? undefined : (initial?.routineId ?? source?.id),
                name: rest ? 'Rest day' : (initial?.name ?? source!.name),
                status: rest ? 'rest' : 'planned',
                items: rest ? [] : structuredClone(initial?.items ?? source!.items),
                groups: rest ? [] : structuredClone(initial?.groups ?? source!.groups),
                notes,
              },
              initial,
            );
            onClose();
          }, 'Training plan saved');
        }}
      >
        <Field label="Training date">
          <input required type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        {!initial && (
          <Field label="Routine">
            <select value={routine} onChange={(e) => select(e.target.value)}>
              <option value="">Choose routine</option>
              {data.routines.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!initial && (
          <label className="check-label">
            <input type="checkbox" checked={rest} onChange={(e) => setRest(e.target.checked)} />{' '}
            Plan a rest day
          </label>
        )}
        {initial && <p>{initial.name} · Existing exercise targets are preserved.</p>}
        <Field label="Plan notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <p className="small-text muted">
          A dated copy keeps its own targets. Changes here do not change your recurring routine.
        </p>
        <Button type="submit">Save training plan</Button>
      </form>
    </Modal>
  );
}
function ClimbingPlanEditor({
  date,
  initial,
  onClose,
}: {
  date: string;
  initial?: ClimbingPlan;
  onClose: () => void;
}) {
  const { run } = useApp();
  const [v, set] = useState<ClimbingPlan>(
    initial ?? {
      id: uid(),
      name: 'Climbing session',
      date,
      type: 'bouldering',
      venue: '',
      notes: '',
      updatedAt: now(),
    },
  );
  const patch = (p: Partial<ClimbingPlan>) => set({ ...v, ...p });
  return (
    <Modal title={initial ? 'Edit climbing plan' : 'Plan climbing'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await saveClimbingRecord('plans', v, initial?.updatedAt);
            onClose();
          }, 'Climbing plan saved');
        }}
      >
        <Field label="Planned session name">
          <input
            required
            maxLength={200}
            value={v.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="Climbing date">
          <input
            required
            type="date"
            value={v.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </Field>
        <Field label="Main climbing type">
          <select
            value={v.type}
            onChange={(e) => patch({ type: e.target.value as ClimbingPlan['type'] })}
          >
            {climbTypes.map((t) => (
              <option key={t} value={t}>
                {climbTypeName[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Venue">
          <input
            maxLength={200}
            value={v.venue}
            onChange={(e) => patch({ venue: e.target.value })}
          />
        </Field>
        <Field label="Climbing plan notes">
          <textarea
            maxLength={10000}
            value={v.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </Field>
        <Button type="submit">Save climbing plan</Button>
      </form>
    </Modal>
  );
}
export function WeekPlanner() {
  const { data, run, toast } = useApp();
  const systems = (data.workspace ?? defaultWorkspace()).systems;
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const requested = params.get('date');
  const [day, setDay] = useState(
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && !isNaN(Date.parse(requested))
      ? requested
      : foodDay(),
  );
  const [editor, setEditor] = useState<{
    type: 'gym' | 'climbing' | 'food';
    date: string;
    id?: string;
  }>();
  const week = combinedWeek(data, day);
  return (
    <>
      <PageTitle
        eyebrow="YOUR WORKSPACE"
        title="Your week"
        description="Training, climbing and meals in one place. Plans and completed records stay clearly labelled."
      />
      <div className="food-actions">
        <Button variant="secondary" onClick={() => setDay(shiftDay(day, -7))}>
          Previous week
        </Button>
        <Field label="Week containing">
          <input
            required
            type="date"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
        </Field>
        <Button variant="secondary" onClick={() => setDay(shiftDay(day, 7))}>
          Next week
        </Button>
        <Button variant="ghost" onClick={() => setDay(foodDay())}>
          This week
        </Button>
      </div>
      {!Object.values(systems).some(Boolean) && (
        <Empty title="Choose a system to plan your week">
          Enable Gym, Climbing or Food in Settings. Your existing plans stay saved.
        </Empty>
      )}
      <div className="week-planner-grid">
        {week.map((w) => (
          <Card key={w.day}>
            <h2>
              {new Date(w.day + 'T12:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              })}
              {w.day === foodDay() ? ' · Today' : ''}
            </h2>
            {systems.gym && (
              <section aria-label={'Training for ' + w.day}>
                <h3>Training</h3>
                {w.workouts.map((s) => (
                  <p key={s.id}>
                    <a href={'#/history?session=' + s.id}>{s.name}</a> · Completed
                  </p>
                ))}
                {w.plans
                  .filter((p) => !w.workouts.some((s) => s.planId === p.id))
                  .map((p) => (
                    <div className="week-plan-row" key={p.id}>
                      <strong>{p.name}</strong>
                      <small>
                        {p.status === 'rest'
                          ? 'Rest planned'
                          : p.status === 'started'
                            ? 'Started'
                            : 'Planned'}
                      </small>
                      {p.notes && <p className="preserve-lines">{p.notes}</p>}
                      {p.status !== 'started' && (
                        <div className="inline-actions">
                          <Button
                            variant="ghost"
                            onClick={() => setEditor({ type: 'gym', date: w.day, id: p.id })}
                          >
                            Edit or move {p.name}
                          </Button>
                          <AsyncButton
                            variant="ghost"
                            onAction={() =>
                              run(async () => {
                                if (confirm(`Remove ${p.name} from ${w.day}?`)) {
                                  await deleteWeekGymPlan(p);
                                  toast('Training plan removed');
                                }
                              })
                            }
                          >
                            Remove plan
                          </AsyncButton>
                        </div>
                      )}
                    </div>
                  ))}
                {w.routines.map((r) => (
                  <p key={r.id}>
                    <a href={'#/routines?routine=' + r.id}>{r.name}</a> · Weekly routine
                  </p>
                ))}
                {!w.workouts.length && !w.plans.length && !w.routines.length && (
                  <p className="small-text muted">No training scheduled.</p>
                )}
                <Button variant="secondary" onClick={() => setEditor({ type: 'gym', date: w.day })}>
                  Plan training on {w.day}
                </Button>
              </section>
            )}
            {systems.climbing && (
              <section aria-label={'Climbing for ' + w.day}>
                <h3>Climbing</h3>
                {w.climbs.map((s) => (
                  <p key={s.id}>
                    <a href="#/climbing-log">{s.name}</a> · Completed
                  </p>
                ))}
                {w.climbingPlans.map((p) => (
                  <div className="week-plan-row" key={p.id}>
                    <strong>{p.name}</strong>
                    <small>
                      {climbTypeName[p.type]} · {p.venue || 'Venue unspecified'} · Planned
                    </small>
                    <div className="inline-actions">
                      <Button
                        variant="ghost"
                        onClick={() => setEditor({ type: 'climbing', date: w.day, id: p.id })}
                      >
                        Edit or move {p.name}
                      </Button>
                      {p.date <= foodDay() && (
                        <a
                          className="button ghost"
                          href={'#/climbing-log?new=1&plan=' + encodeURIComponent(p.id)}
                        >
                          Log this session
                        </a>
                      )}
                      <AsyncButton
                        variant="ghost"
                        onAction={() =>
                          run(async () => {
                            if (!confirm(`Remove ${p.name} from ${w.day}?`)) return;
                            await changeClimbing((c) => {
                              if (c.plans.find((x) => x.id === p.id)?.updatedAt !== p.updatedAt)
                                throw Error('This plan changed in another tab.');
                              c.plans = c.plans.filter((x) => x.id !== p.id);
                            });
                            toast('Climbing plan removed');
                          })
                        }
                      >
                        Remove plan
                      </AsyncButton>
                    </div>
                  </div>
                ))}
                {!w.climbs.length && !w.climbingPlans.length && (
                  <p className="small-text muted">No climbing scheduled.</p>
                )}
                <Button
                  variant="secondary"
                  onClick={() => setEditor({ type: 'climbing', date: w.day })}
                >
                  Plan climbing on {w.day}
                </Button>
              </section>
            )}
            {systems.food && (
              <section aria-label={'Food for ' + w.day}>
                <h3>Food</h3>
                {w.meals.map((p) => (
                  <div className="week-plan-row" key={p.id}>
                    <strong>
                      {data.food?.recipes.find((r) => r.id === p.recipeId)?.name ??
                        'Unavailable recipe'}
                    </strong>
                    <small>
                      {p.slot} · {p.servings} servings · Planned
                    </small>
                    <Button
                      variant="ghost"
                      onClick={() => setEditor({ type: 'food', date: w.day, id: p.id })}
                    >
                      Edit or move meal
                    </Button>
                  </div>
                ))}
                <p className="small-text muted">
                  {w.foodEntries.length ? (
                    <a href={'#/food-diary?date=' + w.day}>
                      {w.foodEntries.length} food entries logged
                    </a>
                  ) : (
                    'No food logged.'
                  )}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setEditor({ type: 'food', date: w.day })}
                >
                  Plan meal on {w.day}
                </Button>
              </section>
            )}
          </Card>
        ))}
      </div>
      {editor?.type === 'gym' && (
        <GymPlanEditor
          date={editor.date}
          initial={data.plans.find((p) => p.id === editor.id)}
          onClose={() => setEditor(undefined)}
        />
      )}
      {editor?.type === 'climbing' && (
        <ClimbingPlanEditor
          date={editor.date}
          initial={(data.climbing ?? emptyClimbing).plans.find((p) => p.id === editor.id)}
          onClose={() => setEditor(undefined)}
        />
      )}
      {editor?.type === 'food' && (
        <PlanEditor
          date={editor.date}
          initial={data.food?.mealPlans.find((p) => p.id === editor.id)}
          onClose={() => setEditor(undefined)}
        />
      )}
    </>
  );
}
