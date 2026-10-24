import { useMemo, useState } from 'react';
import { useApp } from '../lib/context';
import { foodDay } from '../lib/food-calc';
import { previewFoodAvoidances, saveFoodAvoidances } from '../lib/food-avoidances';
import { useFood } from './FoodUI';
import { Button, Field, Modal } from './ui';

export function FoodAvoidances({
  scheduleId,
  onClose,
}: {
  scheduleId: string;
  onClose: () => void;
}) {
  const food = useFood();
  const { run } = useApp();
  const schedule = food.foodSchedules.find((value) => value.id === scheduleId);
  const [openedSchedule] = useState(() => JSON.stringify(schedule));
  const scheduleChanged = JSON.stringify(schedule) !== openedSchedule;
  const [selected, setSelected] = useState(() => schedule?.exclusions ?? []);
  const [search, setSearch] = useState('');
  const [saveError, setSaveError] = useState('');
  const today = foodDay();
  const { preview, error } = useMemo(() => {
    try {
      return { preview: previewFoodAvoidances(food, scheduleId, selected, today), error: '' };
    } catch (problem) {
      return {
        preview: undefined,
        error: problem instanceof Error ? problem.message : String(problem),
      };
    }
  }, [food, scheduleId, selected, today]);
  const query = search.trim().toLocaleLowerCase();
  const ingredients = food.ingredients
    .filter((ingredient) => !ingredient.archived || selected.includes(ingredient.id))
    .filter((ingredient) =>
      [ingredient.name, ingredient.brand, ...ingredient.aliases].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.brand.localeCompare(b.brand));
  const replacements = preview?.changes.filter((change) => change.replacement).length ?? 0;
  const removals = preview?.changes.filter((change) => !change.replacement).length ?? 0;
  const message = scheduleChanged
    ? 'This programme changed while these preferences were open. Close this window and reopen Foods I avoid to review its latest settings.'
    : error || saveError;
  return (
    <Modal title="Foods I avoid" onClose={onClose} wide>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!preview || scheduleChanged) return;
          setSaveError('');
          void run(async () => {
            try {
              await saveFoodAvoidances(preview);
              onClose();
            } catch (problem) {
              setSaveError(problem instanceof Error ? problem.message : String(problem));
              throw problem;
            }
          }, 'Food preferences saved');
        }}
      >
        <p>
          <strong>{schedule?.snapshot.name ?? 'Food programme'}</strong>
        </p>
        <p>
          Select ingredients you prefer to leave out of this programme. These choices use your saved
          ingredient lists; they do not check allergy suitability or cross-contamination.
        </p>
        <Field label="Search ingredients">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </Field>
        {selected.length > 0 && (
          <p className="small-text">
            Selected:{' '}
            {selected
              .map(
                (id) =>
                  food.ingredients.find((ingredient) => ingredient.id === id)?.name ??
                  'Missing ingredient',
              )
              .join(', ')}
          </p>
        )}
        <fieldset className="food-editor-row">
          <legend>Foods to avoid</legend>
          {ingredients.map((ingredient) => (
            <label className="check-label" key={ingredient.id}>
              <input
                type="checkbox"
                checked={selected.includes(ingredient.id)}
                onChange={(event) => {
                  setSelected((values) =>
                    event.target.checked
                      ? [...values, ingredient.id]
                      : values.filter((id) => id !== ingredient.id),
                  );
                  setSaveError('');
                }}
              />
              <span>
                {ingredient.name}
                {ingredient.brand ? ` · ${ingredient.brand}` : ''}
              </span>
            </label>
          ))}
          {!ingredients.length && <p className="muted">No ingredients match your search.</p>}
        </fieldset>
        <h3>Review upcoming changes</h3>
        <p className="small-text muted">
          Only unchecked programme meals from today can change. Past meals, diary records, manual
          plans and swaps that fit your preferences stay as they are. Currently empty slots stay
          empty.
        </p>
        {preview &&
          (preview.changes.length ? (
            <>
              <p aria-live="polite">
                {replacements} meal{replacements === 1 ? '' : 's'} will be replaced; {removals}{' '}
                planned meal{removals === 1 ? '' : 's'} will be removed and left empty.
              </p>
              <ul>
                {preview.changes.map(({ plan, beforeName, replacement }) => (
                  <li key={plan.id} className="preserve-lines">
                    <strong>
                      {plan.date} · {plan.slot}
                    </strong>
                    <p>
                      {beforeName} →{' '}
                      {replacement
                        ? replacement.name
                        : 'Remove planned meal — leave empty (no suitable alternative).'}
                    </p>
                  </li>
                ))}
              </ul>
              {removals > 0 && (
                <p className="small-text muted">
                  Removed slots remain empty if you change these preferences later. You can add a
                  meal in the meal planner whenever you want.
                </p>
              )}
            </>
          ) : (
            <p aria-live="polite">
              No planned meals need changing. Your choices also apply when you plan more meals in
              this programme.
            </p>
          ))}
        {message && <p role="alert">{message}</p>}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!preview || scheduleChanged}>
            Save food preferences
          </Button>
        </div>
      </form>
    </Modal>
  );
}
