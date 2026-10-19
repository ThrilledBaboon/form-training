import { useState } from 'react';
import { useFood, MacroSummary } from './FoodUI';
import { suggestMeals, type MealPriority } from '../lib/meal-suggestions';
import { foodDay, money } from '../lib/food-calc';
import { mealSlots, type Recipe } from '../lib/food-model';
import { PlanEditor } from '../pages/FoodPlanner';
import { FoodEntryEditor } from '../pages/FoodDiary';
import { Button, Card, Empty, Field, Modal, PageTitle } from './ui';
export function MealSuggestions({ onClose }: { onClose?: () => void }) {
  const food = useFood();
  const Heading = onClose ? 'h3' : 'h2';
  const [priority, setPriority] = useState<MealPriority>('balanced'),
    [category, setCategory] = useState('');
  const [maxMinutes, setMaxMinutes] = useState(''),
    [maxCost, setMaxCost] = useState('');
  const [action, setAction] = useState<{ type: 'plan' | 'log'; recipe: Recipe }>();
  const rows = suggestMeals(food, {
    priority,
    category: category ? (category as Recipe['category']) : undefined,
    maxMinutes: maxMinutes ? +maxMinutes : undefined,
    maxCost: maxCost ? +maxCost : undefined,
  });
  if (action?.type === 'plan')
    return (
      <PlanEditor
        date={foodDay()}
        recipeId={action.recipe.id}
        onClose={() => setAction(undefined)}
      />
    );
  if (action?.type === 'log')
    return (
      <FoodEntryEditor
        date={foodDay()}
        recipeId={action.recipe.id}
        defaultSlot={action.recipe.category}
        onClose={() => setAction(undefined)}
      />
    );
  const content = (
    <>
      <p>
        Suggestions use one serving of your saved recipes. Macro fit uses today’s logged food and
        your saved gram goals. Planned meals are not counted as eaten.
      </p>
      <div className="form-grid">
        <Field label="Meal priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as MealPriority)}>
            <option value="balanced">Balanced</option>
            <option value="macros">Remaining macros</option>
            <option value="stock">Use kitchen stock & expiry</option>
            <option value="quick">Quickest recorded time</option>
            <option value="cost">Lowest recorded cost</option>
          </select>
        </Field>
        <Field label="Meal category">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Any meal</option>
            {mealSlots.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Maximum minutes (optional)">
          <input
            type="number"
            min={1}
            value={maxMinutes}
            onChange={(e) => setMaxMinutes(e.target.value)}
          />
        </Field>
        <Field label={'Maximum cost per serving (' + food.foodSettings.currency + ', optional)'}>
          <input
            type="number"
            min={0}
            step="any"
            value={maxCost}
            onChange={(e) => setMaxCost(e.target.value)}
          />
        </Field>
      </div>
      <p className="small-text muted">
        A time or budget limit excludes recipes whose time or full cost is unknown. Prices are
        estimates from your recorded purchases. Expiry dates and stock quantities should be checked
        before cooking.
      </p>
      {!rows.length && (
        <Empty title="No recipes match this view">
          Add a recipe in Menu, or loosen the filters. Archived recipes, drafts and recipes without
          ingredients are excluded.
        </Empty>
      )}
      <div className="meal-suggestion-list">
        {rows.slice(0, 12).map((s) => (
          <Card key={s.recipe.id}>
            <Heading>{s.recipe.name}</Heading>
            <p>
              {s.minutes === undefined ? 'Time unrecorded' : s.minutes + ' min'} ·{' '}
              {s.nutrition.cost === undefined
                ? 'Full cost unknown'
                : money(s.nutrition.cost, food.foodSettings.currency) + ' per serving'}
            </p>
            <MacroSummary macros={s.nutrition.macros} compact />
            <ul>
              {s.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {s.nutrition.estimated && (
              <p className="small-text muted">Includes manually entered or estimated nutrition.</p>
            )}
            {s.nutrition.missing.length > 0 && (
              <details>
                <summary>Incomplete nutrition</summary>
                <ul>
                  {s.nutrition.missing.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </details>
            )}
            <details>
              <summary>Recipe & shortages</summary>
              <p className="preserve-lines">{s.recipe.description}</p>
              {s.recipe.steps.map((step, i) => (
                <p className="preserve-lines" key={step.id}>
                  {i + 1}. {step.text}
                </p>
              ))}
              {s.shortages.length > 0 && (
                <ul>
                  {s.shortages.map((line) => (
                    <li key={line.id}>
                      {line.name}: {Number(line.shortage?.toFixed(2))} {line.unit} short
                    </li>
                  ))}
                </ul>
              )}
            </details>
            <div className="inline-actions">
              <Button
                variant="secondary"
                onClick={() => setAction({ type: 'plan', recipe: s.recipe })}
              >
                Plan {s.recipe.name}
              </Button>
              <Button onClick={() => setAction({ type: 'log', recipe: s.recipe })}>
                Log {s.recipe.name}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
  return onClose ? (
    <Modal title="Suggest a meal" onClose={onClose} wide>
      {content}
    </Modal>
  ) : (
    <>
      <PageTitle
        eyebrow="YOUR FOOD"
        title="Suggest a meal"
        description="A few useful options from your own menu."
      />
      {content}
    </>
  );
}
export function SuggestMealButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Suggest a meal
      </Button>
      {open && <MealSuggestions onClose={() => setOpen(false)} />}
    </>
  );
}
