import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp, go } from '../lib/context';
import { uid, now } from '../lib/model';
import { mealSlots, type MealPlan } from '../lib/food-model';
import {
  saveMealPlan,
  deleteMealPlan,
  saveShoppingList,
  regenerateShopping,
} from '../lib/food-actions';
import {
  foodDay,
  weekDays,
  shiftDay,
  plannedNutrition,
  addMacros,
  foodNumber,
  money,
  recipeAvailability,
} from '../lib/food-calc';
import { FoodNav, useFood, MacroSummary, FoodEmpty } from '../components/FoodUI';
import { FoodEntryEditor } from './FoodDiary';
import {
  Card,
  PageTitle,
  SectionTitle,
  Button,
  AsyncButton,
  Field,
  Modal,
  Badge,
} from '../components/ui';
import { db } from '../lib/db';
export function PlanEditor({
  date,
  initial,
  recipeId,
  onClose,
}: {
  date: string;
  initial?: MealPlan;
  recipeId?: string;
  onClose: () => void;
}) {
  const food = useFood();
  const { run } = useApp();
  const [value, set] = useState<MealPlan>(
    initial ?? {
      id: uid(),
      date,
      slot: 'Dinner',
      recipeId: recipeId ?? food.recipes.find((r) => !r.archived && !r.draft)?.id ?? '',
      servings: 1,
      notes: '',
      createdAt: now(),
    },
  );
  const [copies, setCopies] = useState<string[]>([]);
  const patch = (p: Partial<MealPlan>) => set({ ...value, ...p });
  const snapshot = plannedNutrition(food, value);
  return (
    <Modal title={initial ? 'Edit planned meal' : 'Plan a meal'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await db.transaction('rw', db.tables, async () => {
              await saveMealPlan(value);
              for (const date of copies)
                if (date !== value.date)
                  await saveMealPlan({ ...value, id: uid(), date, createdAt: now() });
            });
            onClose();
          }, 'Meal plan saved; linked shopping lists recalculated');
        }}
      >
        <Field label="Planned recipe">
          <select
            required
            value={value.recipeId}
            onChange={(e) => patch({ recipeId: e.target.value, batchId: undefined })}
          >
            <option value="">Choose recipe</option>
            {food.recipes
              .filter((r) => !r.archived || r.id === value.recipeId)
              .map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Use prepared leftovers (optional)">
          <select
            value={value.batchId ?? ''}
            onChange={(e) => patch({ batchId: e.target.value || undefined })}
          >
            <option value="">Cook from ingredients</option>
            {food.batches
              .filter((b) => b.recipeId === value.recipeId && b.remaining > 0)
              .map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name} · {foodNumber(b.remaining)} remaining · {b.prepared}
                </option>
              ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Planned date">
            <input
              required
              type="date"
              value={value.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </Field>
          <Field label="Planned meal">
            <select
              value={value.slot}
              onChange={(e) => patch({ slot: e.target.value as MealPlan['slot'] })}
            >
              {mealSlots.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Planned servings">
            <input
              type="number"
              min={0.01}
              step="any"
              required
              value={value.servings}
              onChange={(e) => patch({ servings: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Plan notes">
          <textarea value={value.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>
        <fieldset className="food-editor-row">
          <legend>Also copy to these days</legend>
          <div className="food-copy-days">
            {weekDays(value.date)
              .filter((d) => d !== value.date)
              .map((d) => (
                <label className="check-label" key={d}>
                  <input
                    type="checkbox"
                    checked={copies.includes(d)}
                    onChange={(e) =>
                      setCopies(e.target.checked ? [...copies, d] : copies.filter((x) => x !== d))
                    }
                  />
                  {new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </label>
              ))}
          </div>
        </fieldset>
        <MacroSummary macros={snapshot.macros} compact />
        <p className="small-text muted">
          Planning does not consume stock or record food eaten. Prepared portions are reserved only
          by your plan, not deducted.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save planned meal</Button>
        </div>
      </form>
    </Modal>
  );
}
export function FoodPlanner() {
  const food = useFood();
  const { data, run } = useApp();
  const query = new URLSearchParams(location.hash.split('?')[1]);
  const [date, setDate] = useState(query.get('date') ?? foodDay());
  const [view, setView] = useState('week');
  const [editor, setEditor] = useState<MealPlan | null | undefined>(
    query.has('recipe') ? null : undefined,
  );
  const [log, setLog] = useState<MealPlan>();
  const week = weekDays(date),
    days = view === 'day' ? [date] : week;
  const plans = food.mealPlans.filter((p) => p.date >= week[0] && p.date <= week[6]);
  const forecasts = plans.map((p) => plannedNutrition(food, p).cost);
  const totalCost = forecasts.every((c) => c !== undefined)
    ? forecasts.reduce<number>((n, c) => n + c!, 0)
    : undefined;
  const overbooked = food.batches.filter(
    (b) =>
      plans.filter((p) => p.batchId === b.id).reduce((n, p) => n + p.servings, 0) > b.remaining,
  );
  return (
    <>
      <FoodNav />
      <PageTitle
        eyebrow="A FLEXIBLE PLAN"
        title="Meals & training"
        description="Plan the meals you need. Keep what you plan separate from what you eat."
        action={
          <Button onClick={() => setEditor(null)}>
            <Plus size={16} />
            Plan a meal
          </Button>
        }
      />
      <div className="food-date-bar">
        <Button
          variant="ghost"
          aria-label="Previous meal week"
          onClick={() => setDate(shiftDay(date, view === 'day' ? -1 : -7))}
        >
          <ChevronLeft size={20} />
        </Button>
        <Field label="Meal planner date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button
          variant="ghost"
          aria-label="Next meal week"
          onClick={() => setDate(shiftDay(date, view === 'day' ? 1 : 7))}
        >
          <ChevronRight size={20} />
        </Button>
        <Field label="Meal planner view">
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="week">Week</option>
            <option value="day">Day</option>
          </select>
        </Field>
        <AsyncButton
          variant="secondary"
          onAction={() =>
            run(async () => {
              const id = uid();
              await saveShoppingList({
                id,
                name: 'Meals ' + week[0] + ' to ' + week[6],
                from: week[0],
                to: week[6],
                items: [],
                createdAt: now(),
                updatedAt: now(),
              });
              await regenerateShopping(id);
              go('food-shopping');
            })
          }
        >
          Shop this week
        </AsyncButton>
      </div>
      <p className="small-text muted">
        Week’s estimated ingredient consumption cost: {money(totalCost, food.foodSettings.currency)}
        . Checkout spending depends on package sizes and existing stock.
      </p>
      {overbooked.length > 0 && (
        <p className="callout">
          More prepared portions are planned than remain for:{' '}
          {overbooked.map((b) => b.name).join(', ')}. Adjust the plan or prepare another batch.
        </p>
      )}
      <div className={'meal-calendar ' + (view === 'day' ? 'day-view' : '')}>
        {days.map((day) => {
          const entries = food.mealPlans
            .filter((p) => p.date === day)
            .sort((a, b) => mealSlots.indexOf(a.slot) - mealSlots.indexOf(b.slot));
          const gym = (data.workspace?.systems.gym === false ? [] : data.plans).filter(
            (p) => p.date === day,
          );
          const sessions = (data.workspace?.systems.gym === false ? [] : data.sessions).filter(
            (s) => foodDay(new Date(s.startAt)) === day && s.status === 'completed',
          );
          const weeklyRoutines = (
            data.workspace?.systems.gym === false ? [] : data.routines
          ).filter((r) => r.weekdays.includes(new Date(day + 'T12:00:00').getDay()));
          return (
            <section
              key={day}
              className={'meal-calendar-day ' + (day === foodDay() ? 'is-today' : '')}
            >
              <h2>
                {new Date(day + 'T12:00:00').toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </h2>
              <div className="meal-workouts">
                {gym.map((p) => (
                  <a key={p.id} href="#/calendar">
                    {p.status === 'rest' ? 'Rest' : 'Workout'} · {p.name}
                  </a>
                ))}
                {sessions.map((s) => (
                  <a key={s.id} href={'#/history?session=' + s.id}>
                    Completed · {s.name}
                  </a>
                ))}
                {!gym.length &&
                  !sessions.length &&
                  weeklyRoutines.map((r) => (
                    <a key={r.id} href="#/routines">
                      Routine · {r.name}
                    </a>
                  ))}
              </div>
              {entries.map((p) => {
                const recipe = food.recipes.find((r) => r.id === p.recipeId);
                const nutrition = plannedNutrition(food, p);
                const missing =
                  recipe && !p.batchId ? recipeAvailability(food, recipe, p.servings) : [];
                return (
                  <article className="meal-plan-card" key={p.id}>
                    <span className="eyebrow">{p.slot}</span>
                    <h3>{recipe?.name}</h3>
                    <p>
                      {foodNumber(p.servings)} servings{p.batchId ? ' · Prepared leftovers' : ''}
                    </p>
                    <MacroSummary macros={nutrition.macros} compact />
                    <p className="small-text muted">
                      {money(nutrition.cost, food.foodSettings.currency)} est.
                      {missing.length ? ` · ${missing.length} ingredient shortages` : ''}
                    </p>
                    <p>{p.notes}</p>
                    <div className="food-actions">
                      <Button
                        variant="ghost"
                        aria-label={'Edit plan ' + recipe?.name + ' ' + day}
                        onClick={() => setEditor(p)}
                      >
                        <Pencil size={15} />
                      </Button>
                      <AsyncButton
                        variant="ghost"
                        aria-label={'Delete plan ' + recipe?.name + ' ' + day}
                        onAction={() =>
                          run(async () => {
                            if (confirm('Remove this planned meal? Your diary and stock are kept.'))
                              await deleteMealPlan(p.id);
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </AsyncButton>
                      <Button
                        variant="secondary"
                        disabled={day > foodDay()}
                        onClick={() => setLog(p)}
                      >
                        Log eaten
                      </Button>
                    </div>
                  </article>
                );
              })}
              {!entries.length && <p className="muted small-text">No meals planned.</p>}
              <div className="meal-day-total">
                <strong>Planned day</strong>
                <MacroSummary
                  macros={addMacros(entries.map((p) => plannedNutrition(food, p).macros))}
                  compact
                />
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setDate(day);
                  setEditor(null);
                }}
              >
                Add meal
              </Button>
            </section>
          );
        })}
      </div>
      {!food.recipes.length && (
        <FoodEmpty>
          Create a recipe in Menu before planning meals. Your gym schedule remains available in
          Training calendar.
        </FoodEmpty>
      )}
      {editor !== undefined && (
        <PlanEditor
          initial={editor ?? undefined}
          date={date}
          recipeId={query.get('recipe') ?? undefined}
          onClose={() => setEditor(undefined)}
        />
      )}{' '}
      {log && (
        <FoodEntryEditor
          date={log.date}
          recipeId={log.recipeId}
          batchId={log.batchId}
          defaultSlot={log.slot}
          defaultServings={log.servings}
          onClose={() => setLog(undefined)}
        />
      )}
    </>
  );
}
